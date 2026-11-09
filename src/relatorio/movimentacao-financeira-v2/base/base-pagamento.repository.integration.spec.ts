/**
 * BasePagamentoRepository coverage against a disposable PostgreSQL database.
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
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { RelatorioGuardadorFinancialMovementRepository } from '../../movimentacao-financeira/relatorio-guardador-financial-movement.repository';
import { RelatorioNovoRemessaFinancialMovementService } from '../../movimentacao-financeira/relatorio-novo-remessa-financial-movement.service';
import { BasePagamentoRepository } from './base-pagamento.repository';

// The old service imports the PDF exporter, which this spec never exercises; the virtual mock
// keeps the suite loadable where pdfkit is not installed (same as the old integration specs).
jest.mock('pdfkit', () => jest.fn(), { virtual: true });

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

function sumByStatus(rows: { status: StatusPagamento; valor: string }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    totals[row.status] = (totals[row.status] ?? 0) + Number(row.valor);
  }
  return totals;
}

// Distinct id/date range from the other movimentacao-financeira integration specs, to avoid
// any cross-contamination when the suites run against the same local database.
const BASE_ID = 996000000;
const USER_ID = BASE_ID + 1;
// Legacy guardador queries require pu."roleId" = 6 unconditionally (GUARDADOR_ROLE_ID) - a
// dedicated user, distinct from the Permissionário fixture user above, is needed for parity
// against the legacy Guardador repository.
const GUARDADOR_USER_ID = BASE_ID + 2;

suite('BasePagamentoRepository (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: BasePagamentoRepository;
  let legacyPermissionarioService: RelatorioNovoRemessaFinancialMovementService;
  let legacyGuardadorRepository: RelatorioGuardadorFinancialMovementRepository;

  beforeAll(async () => {
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
    repository = new BasePagamentoRepository(dataSource);
    legacyGuardadorRepository = new RelatorioGuardadorFinancialMovementRepository(dataSource);
    legacyPermissionarioService = new RelatorioNovoRemessaFinancialMovementService(dataSource, legacyGuardadorRepository);
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
    await dataSource.query(`DELETE FROM ordem_pagamento_guardador WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM public."user" WHERE id IN ($1, $2)`, [USER_ID, GUARDADOR_USER_ID]);
  }

  async function seedUser(): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', 'PERMISSIONARIO V2 TESTE', 1, '99999999502',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [USER_ID, `permissionario-v2-${USER_ID}@example.test`],
    );
  }

  // GUARDADOR_ROLE_ID (6) is required unconditionally by the legacy guardador query builder.
  // This local database has no seed for RoleEnum.agentes (6) - insert it once, idempotently,
  // rather than touching a migration.
  async function seedGuardadorUser(): Promise<void> {
    await dataSource.query(`INSERT INTO role (id, name) VALUES (6, 'agentes') ON CONFLICT (id) DO NOTHING`);
    await dataSource.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', 'GUARDADOR V2 TESTE', 6, '99999999503',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [GUARDADOR_USER_ID, `guardador-v2-${GUARDADOR_USER_ID}@example.test`],
    );
  }

  // One never-grouped order (no detalhe_a at all) plus one grouped-and-sent order
  // (statusRemessa=0, "Criado") on the same date, for the Permissionário profile.
  async function seedPermissionarioAPagarFamily(): Promise<void> {
    const neverGroupedOrderId = BASE_ID + 40;
    const sentOpaId = BASE_ID + 10;
    const sentOrderId = BASE_ID + 41;
    const sentHistoryId = BASE_ID + 20;
    const sentDetailId = BASE_ID + 30;

    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2098-07-10', DATE '2098-07-10', 321, now(), $2, 'CONSORCIO TESTE', NULL, now(), now())`,
      [neverGroupedOrderId, USER_ID],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2098-07-10', 150, NULL, now(), now())`,
      [sentOpaId],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2098-07-05', 150, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
      [sentOrderId, USER_ID, sentOpaId],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa"
      ) VALUES ($1, $2, DATE '2098-07-10', '104', '0001', '99990002', '1', 0)`,
      [sentHistoryId, sentOpaId],
    );

    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, 996001, DATE '2098-07-10', 150, 150, 996001, now(), now())`,
      [sentDetailId, sentHistoryId],
    );
  }

  it('selects the union of never-grouped and already-sent (statusRemessa 0/1) orders as A Pagar, for Permissionario', async () => {
    await seedUser();
    await seedPermissionarioAPagarFamily();

    const rows = await repository.findGroupedRows('permissionario', {
      dataInicio: new Date('2098-07-10T00:00:00.000Z'),
      dataFim: new Date('2098-07-10T00:00:00.000Z'),
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === StatusPagamento.A_PAGAR)).toBe(true);
    expect(rows.map((row) => Number(row.valor)).sort()).toEqual([150, 321]);
  });

  // Same shape as seedPermissionarioAPagarFamily, but using ordem_pagamento_guardador (whose id
  // is not a generated/serial PK) and no "nomeConsorcio" column.
  async function seedGuardadorAPagarFamily(): Promise<void> {
    const neverGroupedOrderId = BASE_ID + 240;
    const sentOpaId = BASE_ID + 210;
    const sentOrderId = BASE_ID + 241;
    const sentHistoryId = BASE_ID + 220;
    const sentDetailId = BASE_ID + 230;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_guardador (
        id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId",
        "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
        "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida",
        "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2098-08-10', DATE '2098-08-10', 654, $2, 'AUTOMATICA', NULL, 0, 0, 0, now(), now())`,
      [neverGroupedOrderId, GUARDADOR_USER_ID],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2098-08-10', 200, NULL, now(), now())`,
      [sentOpaId],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_guardador (
        id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId",
        "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
        "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida",
        "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2098-08-05', DATE '2098-08-05', 200, $2, 'AUTOMATICA', $3, 0, 0, 0, now(), now())`,
      [sentOrderId, GUARDADOR_USER_ID, sentOpaId],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa"
      ) VALUES ($1, $2, DATE '2098-08-10', '104', '0001', '99990002', '1', 1)`,
      [sentHistoryId, sentOpaId],
    );

    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, 996002, DATE '2098-08-10', 200, 200, 996002, now(), now())`,
      [sentDetailId, sentHistoryId],
    );
  }

  it('selects the union of never-grouped and already-sent (statusRemessa 0/1) orders as A Pagar, for Guardador', async () => {
    await seedGuardadorUser();
    await seedGuardadorAPagarFamily();

    const rows = await repository.findGroupedRows('guardador', {
      dataInicio: new Date('2098-08-10T00:00:00.000Z'),
      dataFim: new Date('2098-08-10T00:00:00.000Z'),
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === StatusPagamento.A_PAGAR)).toBe(true);
    expect(rows.map((row) => Number(row.valor)).sort()).toEqual([200, 654]);
  });

  // ADR 0011: an agrupamento with N child orders must count the lote value once, not N times.
  async function seedFanOutFamily(): Promise<void> {
    const opaId = BASE_ID + 310;
    const historyId = BASE_ID + 320;
    const detailId = BASE_ID + 330;
    const childOrderIds = [BASE_ID + 341, BASE_ID + 342, BASE_ID + 343];

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2098-09-10', 5548.80, NULL, now(), now())`,
      [opaId],
    );

    for (const childOrderId of childOrderIds) {
      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, DATE '2098-09-05', 1849.60, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
        [childOrderId, USER_ID, opaId],
      );
    }

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES ($1, $2, DATE '2098-09-10', '104', '0001', '99990002', '1', 3, '00')`,
      [historyId, opaId],
    );

    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, 996003, DATE '2098-09-10', 5548.80, 5548.80, 996003, now(), now())`,
      [detailId, historyId],
    );
  }

  it('counts the lote value once, not once per child order (ADR 0011)', async () => {
    await seedUser();
    await seedFanOutFamily();

    const rows = await repository.findGroupedRows('permissionario', {
      dataInicio: new Date('2098-09-10T00:00:00.000Z'),
      dataFim: new Date('2098-09-10T00:00:00.000Z'),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(StatusPagamento.PAGO);
    expect(Number(rows[0].valor)).toBe(5548.8);
  });

  it('filters by valorMin/valorMax after grouping, not before (ADR 0002)', async () => {
    await seedUser();
    await seedPermissionarioAPagarFamily();

    // Fixture has two final lines (321 and 150). A range that only the 321 line satisfies
    // proves the filter is applied to the already-grouped/exhibited value, not to a raw
    // pre-grouping lancamento.
    const rows = await repository.findGroupedRows('permissionario', {
      dataInicio: new Date('2098-07-10T00:00:00.000Z'),
      dataFim: new Date('2098-07-10T00:00:00.000Z'),
      valorMin: 300,
    });

    expect(rows).toHaveLength(1);
    expect(Number(rows[0].valor)).toBe(321);
  });

  it('includes the last day of the period (ADR 0005 cast, not a timestamp boundary)', async () => {
    await seedUser();
    // dataVencimento is stored as a plain DATE column already (no 03:00 UTC timestamp quirk for
    // this table), so this proves the ::date cast on both the column and the bound keeps the
    // last day inside a same-day window rather than relying on implicit comparison.
    await seedPermissionarioAPagarFamily();

    const rows = await repository.findGroupedRows('permissionario', {
      dataInicio: new Date('2098-07-10T00:00:00.000Z'),
      dataFim: new Date('2098-07-10T00:00:00.000Z'),
    });

    expect(rows.some((row) => Number(row.valor) === 150)).toBe(true);
  });

  // statusRemessa=2 is "Aguardando Pagamento" on its own, distinct from the A Pagar bucket
  // (statusRemessa 0/1) already covered above.
  async function seedAguardandoPagamentoFamily(): Promise<void> {
    const opaId = BASE_ID + 410;
    const orderId = BASE_ID + 441;
    const historyId = BASE_ID + 420;
    const detailId = BASE_ID + 430;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2098-10-10', 777, NULL, now(), now())`,
      [opaId],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2098-10-05', 777, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
      [orderId, USER_ID, opaId],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa"
      ) VALUES ($1, $2, DATE '2098-10-10', '104', '0001', '99990002', '1', 2)`,
      [historyId, opaId],
    );

    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, 996004, DATE '2098-10-10', 777, 777, 996004, now(), now())`,
      [detailId, historyId],
    );
  }

  it('isolates statusRemessa=2 as Aguardando Pagamento, not A Pagar', async () => {
    await seedUser();
    await seedAguardandoPagamentoFamily();

    const rows = await repository.findGroupedRows('permissionario', {
      dataInicio: new Date('2098-10-10T00:00:00.000Z'),
      dataFim: new Date('2098-10-10T00:00:00.000Z'),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(StatusPagamento.AGUARDANDO_PAGAMENTO);
    expect(Number(rows[0].valor)).toBe(777);
  });

  it('with no status selected ("Todos"), returns every bucket together', async () => {
    await seedUser();
    await seedPermissionarioAPagarFamily();
    await seedFanOutFamily();
    await seedAguardandoPagamentoFamily();

    const rows = await repository.findGroupedRows('permissionario', {
      dataInicio: new Date('2098-07-01T00:00:00.000Z'),
      dataFim: new Date('2098-10-31T00:00:00.000Z'),
    });

    const statuses = new Set(rows.map((row) => row.status));
    expect(statuses).toEqual(new Set([StatusPagamento.A_PAGAR, StatusPagamento.PAGO, StatusPagamento.AGUARDANDO_PAGAMENTO]));
  });

  // Parity (ADR 0021 Test-First Plan item 5): the new unified query's totals, summed per
  // status bucket, must match the legacy implementation's totals for the same fixtures/filter.
  // consorcioNome=['CONSORCIO TESTE'] gives the legacy service a consórcio filter so it skips
  // MODAIS_FILTER/NOT_CPF_FILTER (meant for "Favorecido = Todos" with no consórcio picked,
  // which would otherwise drop this fixture's synthetic "CONSORCIO TESTE" favorecido).
  it('matches the legacy Permissionário service totals per status bucket (A Pagar + fan-out dedupe)', async () => {
    await seedUser();
    await seedPermissionarioAPagarFamily();
    await seedFanOutFamily();

    // Both userIds (bypasses the legacy MODAIS_FILTER branch in the "never-sent" sub-query,
    // which keys off userIds/todosVanzeiros, not consórcio) and consorcioNome (bypasses the
    // legacy MODAIS_FILTER/NOT_CPF_FILTER in the "already-sent" sub-query, which keys off
    // hasConsorcioFilter instead) are needed - the two legacy sub-queries gate that filter on
    // different conditions, an inconsistency found while writing this parity test.
    const filter = {
      dataInicio: new Date('2098-07-01T00:00:00.000Z'),
      dataFim: new Date('2098-09-30T00:00:00.000Z'),
      userIds: [USER_ID],
      consorcioNome: ['CONSORCIO TESTE'],
    };

    const [newRows, legacySummary] = await Promise.all([
      repository.findGroupedRows('permissionario', filter),
      legacyPermissionarioService.findFinancialMovementSummary(filter),
    ]);

    const newTotals = sumByStatus(newRows);
    expect(newTotals[StatusPagamento.A_PAGAR] ?? 0).toBe(legacySummary.valorAPagar);
    expect(newTotals[StatusPagamento.PAGO] ?? 0).toBe(legacySummary.valorPago);
  });

  it('matches the legacy Guardador repository totals per status bucket (A Pagar)', async () => {
    await seedGuardadorUser();
    await seedGuardadorAPagarFamily();

    const filter = {
      dataInicio: new Date('2098-08-01T00:00:00.000Z'),
      dataFim: new Date('2098-08-31T00:00:00.000Z'),
      userIds: [GUARDADOR_USER_ID],
    };

    const [newRows, legacySummary] = await Promise.all([
      repository.findGroupedRows('guardador', filter),
      legacyGuardadorRepository.findFinancialMovementSummary(filter),
    ]);

    const newTotals = sumByStatus(newRows);
    expect(newTotals[StatusPagamento.A_PAGAR] ?? 0).toBe(legacySummary.valorAPagar);
  });

  it('matches the legacy Permissionário service after a valorMin filter (ADR 0002)', async () => {
    await seedUser();
    await seedPermissionarioAPagarFamily();

    const filter = {
      dataInicio: new Date('2098-07-01T00:00:00.000Z'),
      dataFim: new Date('2098-07-31T00:00:00.000Z'),
      userIds: [USER_ID],
      consorcioNome: ['CONSORCIO TESTE'],
      valorMin: 300,
    };

    const [newRows, legacySummary] = await Promise.all([
      repository.findGroupedRows('permissionario', filter),
      legacyPermissionarioService.findFinancialMovementSummary(filter),
    ]);

    const newTotals = sumByStatus(newRows);
    expect(newTotals[StatusPagamento.A_PAGAR] ?? 0).toBe(legacySummary.valorAPagar);
    expect(legacySummary.valorAPagar).toBe(321);
  });
});
