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
      ) VALUES ($1, DATE '2097-07-10', DATE '2097-07-10', 321, now(), $2, 'STPC', NULL, now(), now())`,
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
      ) VALUES ($1, DATE '2097-07-05', 150, now(), $2, 'STPC', $3, now(), now())`,
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
        ) VALUES ($1, DATE '2097-09-05', 1849.60, now(), $2, 'STPC', $3, now(), now())`,
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
      ) VALUES ($1, DATE '2097-10-05', 777, now(), $2, 'STPC', $3, now(), now())`,
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

  // T1 (fatia 2, ADR 0022): Pendencia Paga / Pendencia de Pagamento, now unblocked at the
  // controller/aggregator level - findGroupedRows already exposes these sources since T5 of
  // ADR 0021 (no change there), these tests cover the aggregator consuming them.

  // 1 pai (dataPagamento = D) + 1 filha (dataPagamento = outra data, para provar que a consulta
  // usa a data do PAI, nao da filha), filha com status 5 (Pendencia Paga) e seu proprio
  // detalhe_a/valor - mesmo shape do fixture de T5 (base-pagamento.repository.integration.spec.ts).
  async function seedPendenciaPagaFamily(): Promise<void> {
    const opaPaiId = BASE_ID + 500;
    const opaFilhaId = BASE_ID + 501;
    const orderId = BASE_ID + 502;
    const historyId = BASE_ID + 503;
    const detailId = BASE_ID + 504;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2097-11-10', 500, NULL, now(), now())`,
      [opaPaiId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2097-01-01', 500, $2, now(), now())`,
      [opaFilhaId, opaPaiId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2097-01-01', 500, now(), $2, 'STPC', $3, now(), now())`,
      [orderId, USER_ID, opaFilhaId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
       VALUES ($1, $2, DATE '2097-01-01', '104', '0001', '99990002', '1', 5)`,
      [historyId, opaFilhaId],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, 995500, DATE '2097-01-01', 500, 500, 995500, now(), now())`,
      [detailId, historyId],
    );
  }

  it('Pendencia Paga (familia pai/filha): total bate com a data de pagamento do pai', async () => {
    await seedUser();
    await seedPendenciaPagaFamily();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-11-10T00:00:00.000Z'),
      dataFim: new Date('2097-11-10T00:00:00.000Z'),
      statuses: [StatusPagamento.PENDENCIA_PAGA],
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].valor).toBe(500);
  });

  // PASSO 0: filha paga (status 5) nunca enviada em arquivo proprio (nenhum historico dela tem
  // detalhe_a) - valor = valorTotal da propria filha, data = pagamento do pai.
  async function seedPendenciaPagaPasso0Family(): Promise<void> {
    const opaPaiId = BASE_ID + 510;
    const opaFilhaId = BASE_ID + 511;
    const orderId = BASE_ID + 512;
    const historyId = BASE_ID + 513;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2097-11-20', 650, NULL, now(), now())`,
      [opaPaiId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2097-01-01', 650, $2, now(), now())`,
      [opaFilhaId, opaPaiId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2097-01-01', 650, now(), $2, 'STPC', $3, now(), now())`,
      [orderId, USER_ID, opaFilhaId],
    );
    // So' o historico, sem nenhum detalhe_a - nunca foi enviada em arquivo proprio.
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
       VALUES ($1, $2, DATE '2097-01-01', '104', '0001', '99990002', '1', 5)`,
      [historyId, opaFilhaId],
    );
  }

  it('Pendencia Paga PASSO 0 (filha nunca enviada em lote proprio) aparece com o valor da propria filha', async () => {
    await seedUser();
    await seedPendenciaPagaPasso0Family();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-11-20T00:00:00.000Z'),
      dataFim: new Date('2097-11-20T00:00:00.000Z'),
      statuses: [StatusPagamento.PENDENCIA_PAGA],
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].valor).toBe(650);
  });

  // Familia pai/filha, dia unico: pai rejeitado (status 4, motivo != '02') define status/data;
  // valor vem da filha.
  async function seedRejeitadoFamiliaDiaUnico(): Promise<void> {
    const opaPaiId = BASE_ID + 520;
    const opaFilhaId = BASE_ID + 521;
    const orderId = BASE_ID + 522;
    const historyPaiId = BASE_ID + 523;
    const historyFilhaId = BASE_ID + 524;
    const detailId = BASE_ID + 525;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2097-12-10', 300, NULL, now(), now())`,
      [opaPaiId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2097-01-01', 300, $2, now(), now())`,
      [opaFilhaId, opaPaiId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2097-01-01', 300, now(), $2, 'STPC', $3, now(), now())`,
      [orderId, USER_ID, opaFilhaId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, DATE '2097-01-01', '104', '0001', '99990002', '1', 4, 'AR')`,
      [historyPaiId, opaPaiId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
       VALUES ($1, $2, DATE '2097-01-01', '104', '0001', '99990002', '1', 0)`,
      [historyFilhaId, opaFilhaId],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, 995520, DATE '2097-01-01', 300, 300, 995520, now(), now())`,
      [detailId, historyFilhaId],
    );
  }

  it('Rejeitado (familia, dia unico): total bate com o status/data do historico mais recente do pai', async () => {
    await seedUser();
    await seedRejeitadoFamiliaDiaUnico();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-12-10T00:00:00.000Z'),
      dataFim: new Date('2097-12-10T00:00:00.000Z'),
      statuses: [StatusPagamento.ERRO_REJEITADO],
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].valor).toBe(300);
  });

  // Estorno sem agrupamento pai (ADR 0008), consulta de dia unico.
  async function seedEstornoSemPai(dataPagamento = '2098-01-10'): Promise<void> {
    const opaId = BASE_ID + 530;
    const orderId = BASE_ID + 531;
    const historyId = BASE_ID + 532;
    const detailId = BASE_ID + 533;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '${dataPagamento}', 400, NULL, now(), now())`,
      [opaId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2098-01-01', 400, now(), $2, 'STPC', $3, now(), now())`,
      [orderId, USER_ID, opaId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, DATE '2098-01-01', '104', '0001', '99990002', '1', 4, '02')`,
      [historyId, opaId],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, 995530, DATE '2098-01-01', 400, 400, 995530, now(), now())`,
      [detailId, historyId],
    );
  }

  it('Estorno sem agrupamento pai (ADR 0008) aparece no filtro de dia unico', async () => {
    await seedUser();
    await seedEstornoSemPai();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2098-01-10T00:00:00.000Z'),
      dataFim: new Date('2098-01-10T00:00:00.000Z'),
      statuses: [StatusPagamento.ERRO_ESTORNO],
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].valor).toBe(400);
  });

  it('combo erro (Estorno + Rejeitado) uniao sem duplicar nem somar duas vezes a mesma ordem', async () => {
    await seedUser();
    await seedRejeitadoFamiliaDiaUnico();
    await seedEstornoSemPai('2097-12-10');

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-12-10T00:00:00.000Z'),
      dataFim: new Date('2097-12-10T00:00:00.000Z'),
      statuses: [StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO],
    });

    // Mesmo favorecido (mesmo USER_ID) nas duas fixtures - uma unica linha, soma exata das duas
    // (300 Rejeitado + 400 Estorno), nunca o dobro de qualquer uma delas.
    expect(result.data).toHaveLength(1);
    expect(result.data[0].valor).toBe(300 + 400);
  });

  it('valorAPagar nao inclui Pendencia Paga quando combinada com aPagar no mesmo filtro', async () => {
    await seedUser();
    await seedAPagarFamily();
    await seedPendenciaPagaFamily();

    const result = await aggregator.aggregate({
      dataInicio: new Date('2097-07-01T00:00:00.000Z'),
      dataFim: new Date('2097-11-30T00:00:00.000Z'),
      statuses: [StatusPagamento.A_PAGAR, StatusPagamento.PENDENCIA_PAGA],
    });

    // Mesmo favorecido - uma linha com o total combinado, mas valorAPagar so conta o bucket A
    // Pagar (471), nunca os 500 de Pendencia Paga.
    expect(result.data).toHaveLength(1);
    expect(result.data[0].valor).toBe(471 + 500);
    expect(result.valorAPagar).toBe(471);
  });

  // Paridade: mesmo filtro/fixture, contra o findConsolidado legado (pendenciaPaga/rejeitado
  // isolados, para nao arrastar as outras fontes do UNION legado).
  it('matches the legacy Consolidado total for Pendencia Paga (favorecido)', async () => {
    await seedUser();
    await seedPendenciaPagaFamily();

    const filter = {
      dataInicio: new Date('2097-11-01T00:00:00.000Z'),
      dataFim: new Date('2097-11-30T00:00:00.000Z'),
      userIds: [USER_ID],
      pendenciaPaga: true,
    };

    const [newResult, legacyResult] = await Promise.all([
      aggregator.aggregate({ ...filter, statuses: [StatusPagamento.PENDENCIA_PAGA] }),
      legacyConsolidadoRepository.findConsolidado(filter),
    ]);

    expect(newResult.data).toHaveLength(1);
    expect(legacyResult.data).toHaveLength(1);
    expect(newResult.data[0].valor).toBe(legacyResult.data[0].valor);
  });

  // Rejeitado sem pai: unico formato em que a base v2 e o Consolidado legado usam a mesma linha.
  // Em familia, a base segue o status/data do pai (regra da Movimentacao Financeira) e o legado
  // usa o status/dataVencimento da propria filha - divergencia conhecida, ainda sem decisao.
  async function seedRejeitadoSemPai(data = '2098-02-10', motivo = 'AR'): Promise<void> {
    const opaId = BASE_ID + 540;
    const historyId = BASE_ID + 542;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '${data}', 300, NULL, now(), now())`,
      [opaId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '${data}', 300, now(), $2, 'STPC', $3, now(), now())`,
      [BASE_ID + 541, USER_ID, opaId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, DATE '${data}', '104', '0001', '99990002', '1', 4, '${motivo}')`,
      [historyId, opaId],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, 995540, DATE '${data}', 300, 300, 995540, now(), now())`,
      [BASE_ID + 543, historyId],
    );
  }

  it('matches the legacy Consolidado total for Rejeitado (favorecido)', async () => {
    await seedUser();
    await seedRejeitadoSemPai();

    const filter = {
      dataInicio: new Date('2098-02-10T00:00:00.000Z'),
      dataFim: new Date('2098-02-10T00:00:00.000Z'),
      userIds: [USER_ID],
      rejeitado: true,
    };

    const [newResult, legacyResult] = await Promise.all([
      aggregator.aggregate({ ...filter, statuses: [StatusPagamento.ERRO_REJEITADO] }),
      legacyConsolidadoRepository.findConsolidado(filter),
    ]);

    expect(newResult.data).toHaveLength(1);
    expect(legacyResult.data).toHaveLength(1);
    expect(newResult.data[0].valor).toBe(legacyResult.data[0].valor);
  });

  // Intervalo com datas passadas: a elegibilidade do ADR 0020 trata datas futuras como "ordem de hoje".
  it.each([
    ['rejeitado', StatusPagamento.ERRO_REJEITADO, 'AR', '2001-09-10'],
    ['estorno', StatusPagamento.ERRO_ESTORNO, '02', '2001-10-10'],
  ] as const)('matches the legacy Consolidado total for %s over an interval (favorecido)', async (flag, status, motivo, data) => {
    await seedUser();
    await seedRejeitadoSemPai(data, motivo);

    const filter = {
      dataInicio: new Date(`${data.slice(0, 8)}01T00:00:00.000Z`),
      dataFim: new Date(`${data.slice(0, 8)}28T00:00:00.000Z`),
      userIds: [USER_ID],
      [flag]: true,
    };

    const [newResult, legacyResult] = await Promise.all([aggregator.aggregate({ ...filter, statuses: [status] }), legacyConsolidadoRepository.findConsolidado(filter)]);

    expect(legacyResult.data).toHaveLength(1);
    expect(newResult.data).toHaveLength(1);
    expect(newResult.data[0].valor).toBe(legacyResult.data[0].valor);
  });
});
