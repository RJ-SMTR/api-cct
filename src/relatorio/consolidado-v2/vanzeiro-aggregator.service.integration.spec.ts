/**
 * VanzeiroAggregatorService coverage against a disposable PostgreSQL database.
 * Run with RUN_RETORNO_DB_TESTS=1 only against an isolated local test database.
 */
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import appConfig from 'src/config/app.config';
import databaseConfig from 'src/config/database.config';
import { TypeOrmConfigService } from 'src/database/typeorm-config.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { BasePagamentoRepository } from '../movimentacao-financeira-v2/base/base-pagamento.repository';
import { RelatorioNovoRemessaConsolidadoRepository } from '../novo-remessa/relatorio-novo-remessa-consolidado.repository';
import { VanzeiroAggregatorService } from './vanzeiro-aggregator.service';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

// Distinct id/date range from the other movimentacao-financeira-v2 integration specs, to avoid
// any cross-contamination when the suites run against the same local database.
const BASE_ID = 995000000;
const USER_ID = BASE_ID + 1;
const FULL_NAME = 'PERMISSIONARIO CONSOLIDADO V2 TESTE';

suite('VanzeiroAggregatorService (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let aggregator: VanzeiroAggregatorService;
  let legacyConsolidadoRepository: RelatorioNovoRemessaConsolidadoRepository;

  beforeAll(async () => {
    // legacyConsolidadoRepository.findConsolidado logs via CustomLogger.debug, whose
    // getTimestamp relies on global.__localTzOffset (set by test/global-setup.ts) - not
    // reliably present in every worker process when multiple spec files run together. Same
    // workaround as base-pagamento.repository.integration.spec.ts.
    jest.spyOn(CustomLogger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(CustomLogger.prototype, 'error').mockImplementation(() => undefined);

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig, appConfig],
          envFilePath: ['.env'],
        }),
        TypeOrmModule.forRootAsync({
          useClass: TypeOrmConfigService,
          dataSourceFactory: async (options: DataSourceOptions) => new DataSource(options).initialize(),
        }),
      ],
    }).compile();

    dataSource = moduleRef.get(getDataSourceToken());
    aggregator = new VanzeiroAggregatorService(new BasePagamentoRepository(dataSource));
    legacyConsolidadoRepository = new RelatorioNovoRemessaConsolidadoRepository(dataSource);
  }, 60000);

  beforeEach(async () => {
    await cleanFixtures();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await cleanFixtures();
    }
    await moduleRef?.close();
  });

  async function cleanFixtures(): Promise<void> {
    if (!dataSource?.isInitialized) {
      return;
    }

    await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM public."user" WHERE id = $1`, [USER_ID]);
  }

  async function seedUser(): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', $3, 1, '99999999601',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [USER_ID, `consolidado-v2-${USER_ID}@example.test`, FULL_NAME],
    );
  }

  // One never-grouped order (A Pagar) plus one grouped-and-sent order (statusRemessa=0, also A
  // Pagar), same shape as base-pagamento's seedPermissionarioAPagarFamily, distinct ids.
  async function seedAPagarFamily(): Promise<void> {
    const neverGroupedOrderId = BASE_ID + 40;
    const sentOpaId = BASE_ID + 10;
    const sentOrderId = BASE_ID + 41;
    const sentHistoryId = BASE_ID + 20;
    const sentDetailId = BASE_ID + 30;

    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2097-07-10', DATE '2097-07-10', 321, now(), $2, 'CONSORCIO TESTE', NULL, now(), now())`,
      [neverGroupedOrderId, USER_ID],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2097-07-10', 150, NULL, now(), now())`,
      [sentOpaId],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2097-07-05', 150, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
      [sentOrderId, USER_ID, sentOpaId],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa"
      ) VALUES ($1, $2, DATE '2097-07-10', '104', '0001', '99990002', '1', 0)`,
      [sentHistoryId, sentOpaId],
    );

    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, 995001, DATE '2097-07-10', 150, 150, 995001, now(), now())`,
      [sentDetailId, sentHistoryId],
    );
  }

  it('sums both A Pagar orders (never-grouped + sent) into one row for the favorecido', async () => {
    await seedUser();
    await seedAPagarFamily();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-07-10T00:00:00.000Z'),
      dataFim: new Date('2097-07-10T00:00:00.000Z'),
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].nomefavorecido).toBe(FULL_NAME);
    expect(result.data[0].valor).toBe(471);
    expect(result.valorAPagar).toBe(471);
  });

  // ADR 0011: an agrupamento with N child orders must count the lote value once, not N times -
  // same fixture shape as base-pagamento.repository.integration.spec.ts's seedFanOutFamily.
  async function seedFanOutFamily(): Promise<void> {
    const opaId = BASE_ID + 310;
    const historyId = BASE_ID + 320;
    const detailId = BASE_ID + 330;
    const childOrderIds = [BASE_ID + 341, BASE_ID + 342, BASE_ID + 343];

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2097-09-10', 5548.80, NULL, now(), now())`,
      [opaId],
    );

    for (const childOrderId of childOrderIds) {
      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, DATE '2097-09-05', 1849.60, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
        [childOrderId, USER_ID, opaId],
      );
    }

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES ($1, $2, DATE '2097-09-10', '104', '0001', '99990002', '1', 3, '00')`,
      [historyId, opaId],
    );

    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, 995003, DATE '2097-09-10', 5548.80, 5548.80, 995003, now(), now())`,
      [detailId, historyId],
    );
  }

  it('counts the lote value once for the favorecido total, not once per child order (ADR 0011)', async () => {
    await seedUser();
    await seedFanOutFamily();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-09-10T00:00:00.000Z'),
      dataFim: new Date('2097-09-10T00:00:00.000Z'),
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].valor).toBe(5548.8);
  });

  it('filters by valorMin/valorMax after grouping by favorecido, not before (ADR 0002)', async () => {
    await seedUser();
    await seedAPagarFamily();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-07-10T00:00:00.000Z'),
      dataFim: new Date('2097-07-10T00:00:00.000Z'),
      valorMin: 400,
    });

    // The two orders (321 + 150) are already merged into a single 471 favorecido line before
    // the filter runs; the filter must see that merged value, not reject the 150-only order.
    expect(result.data).toHaveLength(1);
    expect(result.data[0].valor).toBe(471);
  });

  it('includes a favorecido with a line on the last day of the period (ADR 0005 cast)', async () => {
    await seedUser();
    await seedAPagarFamily();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-07-10T00:00:00.000Z'),
      dataFim: new Date('2097-07-10T00:00:00.000Z'),
    });

    expect(result.data).toHaveLength(1);
  });

  it('does not emit a row for a favorecido with no line in the period', async () => {
    await seedUser();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-07-10T00:00:00.000Z'),
      dataFim: new Date('2097-07-10T00:00:00.000Z'),
    });

    expect(result.data).toHaveLength(0);
  });

  // Parity: same filter, same fixtures, against the legacy Consolidado's public findConsolidado
  // (eleicao omitted/false and userIds instead of todosVanzeiros, so only queryAPagarVanzeiros +
  // queryVanzeiros - not Eleição/Pendentes/Pendência Paga - enter the legacy UNION; todosVanzeiros
  // would instead restrict to the MODAIS list, which this fixture's favorecido is not part of).
  it('matches the legacy Consolidado totals per favorecido (A Pagar + Pago, fan-out dedupe)', async () => {
    await seedUser();
    await seedAPagarFamily();
    await seedFanOutFamily();

    const filter = {
      dataInicio: new Date('2097-07-01T00:00:00.000Z'),
      dataFim: new Date('2097-09-30T00:00:00.000Z'),
      userIds: [USER_ID],
      pago: true,
      aPagar: true,
      emProcessamento: true,
    };

    const [newResult, legacyResult] = await Promise.all([
      aggregator.aggregate(filter),
      legacyConsolidadoRepository.findConsolidado(filter),
    ]);

    // valorAPagar is this module's own addition - the legacy findConsolidado never populates
    // that DTO field (confirmed: no assignment to it anywhere in
    // relatorio-novo-remessa-consolidado.repository.ts), so there is no legacy value to match
    // against; the per-favorecido total (data[].valor) is the real parity target here.
    expect(newResult.data).toHaveLength(1);
    expect(legacyResult.data).toHaveLength(1);
    expect(newResult.data[0].valor).toBe(legacyResult.data[0].valor);
  });

  // statusRemessa=2, isolated from the A Pagar bucket (statusRemessa 0/1) covered above - same
  // fixture shape as base-pagamento.repository.integration.spec.ts's seedAguardandoPagamentoFamily.
  async function seedAguardandoPagamentoFamily(): Promise<void> {
    const opaId = BASE_ID + 410;
    const orderId = BASE_ID + 441;
    const historyId = BASE_ID + 420;
    const detailId = BASE_ID + 430;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2097-10-10', 777, NULL, now(), now())`,
      [opaId],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2097-10-05', 777, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
      [orderId, USER_ID, opaId],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa"
      ) VALUES ($1, $2, DATE '2097-10-10', '104', '0001', '99990002', '1', 2)`,
      [historyId, opaId],
    );

    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, 995004, DATE '2097-10-10', 777, 777, 995004, now(), now())`,
      [detailId, historyId],
    );
  }

  it('combining statuses (Pago + A Pagar) unions without duplicating or dropping either bucket', async () => {
    await seedUser();
    await seedAPagarFamily();
    await seedFanOutFamily();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-07-01T00:00:00.000Z'),
      dataFim: new Date('2097-09-30T00:00:00.000Z'),
      statuses: [StatusPagamento.A_PAGAR, StatusPagamento.PAGO],
    });

    // Same favorecido across both fixtures: 471 (A Pagar) + 5548.80 (Pago) summed into one row.
    expect(result.data).toHaveLength(1);
    expect(result.data[0].valor).toBe(471 + 5548.8);
    expect(result.valorAPagar).toBe(471);
  });

  it('a wide window (90 days) with every status does not fail (does not reproduce ADR 0016)', async () => {
    await seedUser();
    await seedAPagarFamily();
    await seedFanOutFamily();
    await seedAguardandoPagamentoFamily();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-07-01T00:00:00.000Z'),
      dataFim: new Date('2097-10-31T00:00:00.000Z'),
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].valor).toBe(471 + 5548.8 + 777);
  });
});
