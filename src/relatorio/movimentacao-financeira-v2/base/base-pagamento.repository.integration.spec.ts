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
import { RelatorioNovoRemessaConsolidadoRepository } from '../../novo-remessa/relatorio-novo-remessa-consolidado.repository';
import { BasePagamentoRepository } from './base-pagamento.repository';
import { resolveCursorFromQuery } from '../summary/financial-movement-v2-query.mapper';

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
      userIds: [USER_ID],
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
      userIds: [USER_ID],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(StatusPagamento.PAGO);
    expect(Number(rows[0].valor)).toBe(5548.8);
  });

  // valorMin/valorMax valem sobre o total do favorecido no periodo (mesma regra do Consolidado):
  // a fixture tem duas linhas (321 e 150) do mesmo favorecido, total 471.
  describe('filtro de valor sobre o total', () => {
    const periodo = { dataInicio: new Date('2098-07-10T00:00:00.000Z'), dataFim: new Date('2098-07-10T00:00:00.000Z'), userIds: [USER_ID] };

    beforeEach(async () => {
      await seedUser();
      await seedPermissionarioAPagarFamily();
    });

    it.each([
      [{ valorMin: 400 }, 2],
      [{ valorMin: 500 }, 0],
      [{ valorMax: 500 }, 2],
      [{ valorMax: 400 }, 0],
    ])('%j devolve %i linhas', async (limites, esperado) => {
      const rows = await repository.findGroupedRows('permissionario', { ...periodo, ...limites });

      expect(rows).toHaveLength(esperado);
    });

    it('keeps the favorecido total across page cuts', async () => {
      const filtro = { ...periodo, valorMin: 400 };
      const primeira = await repository.findGroupedRowsPage('permissionario', filtro, 1);
      expect(primeira.rows).toHaveLength(1);
      expect(primeira.nextCursor).not.toBeNull();

      const segunda = await repository.findGroupedRowsPage('permissionario', filtro, 1, primeira.nextCursor as NonNullable<typeof primeira.nextCursor>);
      expect(segunda.rows).toHaveLength(1);
      expect(segunda.nextCursor).toBeNull();
    });

    // TD-21: duas linhas empatadas nas 5 primeiras colunas do cursor, diferindo so por valor.
    it('pages through rows that tie on the first five cursor columns using the request cursor', async () => {
      for (const [offset, valor] of [
        [43, 100],
        [44, 200],
      ]) {
        await dataSource.query(
          `INSERT INTO ordem_pagamento (id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
           VALUES ($1, DATE '2098-07-20', DATE '2098-07-20', $2, now(), $3, 'CONSORCIO TESTE', NULL, now(), now())`,
          [BASE_ID + offset, valor, USER_ID],
        );
      }
      const filtro = { dataInicio: new Date('2098-07-20T00:00:00.000Z'), dataFim: new Date('2098-07-20T00:00:00.000Z'), userIds: [USER_ID] };

      const primeira = await repository.findGroupedRowsPage('permissionario', filtro, 1);
      const c = primeira.nextCursor as NonNullable<typeof primeira.nextCursor>;
      const cursor = resolveCursorFromQuery({
        ...filtro,
        cursorDataReferencia: c.dataReferencia as string,
        cursorNome: c.nomes ?? undefined,
        cursorCpfCnpj: c.cpfCnpj ?? undefined,
        cursorNomeConsorcio: c.nomeConsorcio ?? undefined,
        cursorStatus: c.status ?? undefined,
        cursorValor: c.valor === null ? undefined : String(c.valor),
      });
      const segunda = await repository.findGroupedRowsPage('permissionario', filtro, 1, cursor);

      expect([...primeira.rows, ...segunda.rows].map((row) => Number(row.valor)).sort((x, y) => x - y)).toEqual([100, 200]);
      expect(segunda.nextCursor).toBeNull();
    });

    it('uses the consorcio total when a consorcio filter is set, and the favorecido total otherwise', async () => {
      await seedGuardadorUser();
      await dataSource.query(
        `INSERT INTO ordem_pagamento (id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2098-07-10', DATE '2098-07-10', 200, now(), $2, 'CONSORCIO TESTE', NULL, now(), now())`,
        [BASE_ID + 42, GUARDADOR_USER_ID],
      );
      const datas = { dataInicio: periodo.dataInicio, dataFim: periodo.dataFim, valorMin: 600 };

      const porConsorcio = await repository.findGroupedRows('permissionario', { ...datas, consorcioNome: ['CONSORCIO TESTE'] });
      const porFavorecido = await repository.findGroupedRows('permissionario', { ...datas, userIds: [USER_ID, GUARDADOR_USER_ID] });

      expect(porConsorcio).toHaveLength(3);
      expect(porFavorecido).toHaveLength(0);
    });
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
      userIds: [USER_ID],
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
      userIds: [USER_ID],
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
      userIds: [USER_ID],
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

  // T2 do plano consolidado-v2 (ADR 0022): nomeConsorcio adicionado a saida, usando o resolver
  // compartilhado de consorcio-resolver.ts (mesmo CASE que o Consolidado atual ja usa).
  describe('nomeConsorcio', () => {
    const VLT_USER_ID = BASE_ID + 3;

    async function seedVltUser(): Promise<void> {
      await dataSource.query(
        `INSERT INTO public."user" (
          id, email, provider, "fullName", "roleId", "cpfCnpj", "permitCode",
          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'email', 'PERMISSIONARIO VLT V2 TESTE', 1, '99999999504', '8',
          104, '0001', '99990002', '1', false, now(), now()
        )`,
        [VLT_USER_ID, `permissionario-vlt-v2-${VLT_USER_ID}@example.test`],
      );
    }

    async function seedVltAPagarFamily(): Promise<void> {
      const orderId = BASE_ID + 540;

      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, DATE '2098-11-10', DATE '2098-11-10', 888, now(), $2, 'CONSORCIO BRUTO DIVERGENTE', NULL, now(), now())`,
        [orderId, VLT_USER_ID],
      );
    }

    afterEach(async () => {
      await dataSource.query(`DELETE FROM ordem_pagamento WHERE id = $1`, [BASE_ID + 540]);
      await dataSource.query(`DELETE FROM public."user" WHERE id = $1`, [VLT_USER_ID]);
    });

    it('falls back to the raw nomeConsorcio (ELSE) when permitCode does not match any pattern, for Permissionario', async () => {
      await seedUser();
      await seedPermissionarioAPagarFamily();

      const rows = await repository.findGroupedRows('permissionario', {
        dataInicio: new Date('2098-07-10T00:00:00.000Z'),
        dataFim: new Date('2098-07-10T00:00:00.000Z'),
        userIds: [USER_ID],
      });

      expect(rows.every((row) => row.nomeConsorcio === 'CONSORCIO TESTE')).toBe(true);
    });

    it('resolves nomeConsorcio to VLT via permitCode, overriding the raw nomeConsorcio column, for Permissionario', async () => {
      await seedVltUser();
      await seedVltAPagarFamily();

      const rows = await repository.findGroupedRows('permissionario', {
        dataInicio: new Date('2098-11-10T00:00:00.000Z'),
        dataFim: new Date('2098-11-10T00:00:00.000Z'),
        userIds: [VLT_USER_ID],
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].nomeConsorcio).toBe('VLT');
    });

    it('nomeConsorcio for Guardador follows the association rule (fullName when there is no permitCode)', async () => {
      await seedGuardadorUser();
      await seedGuardadorAPagarFamily();

      const rows = await repository.findGroupedRows('guardador', {
        dataInicio: new Date('2098-08-10T00:00:00.000Z'),
        dataFim: new Date('2098-08-10T00:00:00.000Z'),
      });

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.nomeConsorcio === 'GUARDADOR V2 TESTE')).toBe(true);
    });
  });

  // T5 (ADR 0021): Pendencia Paga (status 5) e Pendencia de Pagamento (Estorno/Rejeitado).
  // Datas no passado (nao no futuro, como as demais fixtures deste arquivo) - a regra de
  // elegibilidade de rejeitado (ADR 0020) trata qualquer ordem com dataCaptura >= hoje como
  // "ordem de hoje" (SQL_HOJE_BRASILIA), o que a excluiria da pendencia independente do resto.
  describe('Pendencia Paga / Pendencia de Pagamento (T5)', () => {
    const T5_BASE_ID = 996500000;
    const T5_USER_ID = T5_BASE_ID + 1;

    afterEach(async () => {
      await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [T5_BASE_ID, T5_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, [T5_BASE_ID, T5_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, [T5_BASE_ID, T5_BASE_ID + 999]);
      await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, [T5_BASE_ID, T5_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [T5_BASE_ID, T5_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM public."user" WHERE id = $1`, [T5_USER_ID]);
    });

    async function seedT5User(): Promise<void> {
      await dataSource.query(
        `INSERT INTO public."user" (
          id, email, provider, "fullName", "roleId", "cpfCnpj",
          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'email', 'PERMISSIONARIO T5 TESTE', 1, '99999999601',
          104, '0001', '99990002', '1', false, now(), now()
        )`,
        [T5_USER_ID, `permissionario-t5-${T5_USER_ID}@example.test`],
      );
    }

    // 1 pai (dataPagamento = D) + 1 filha (dataPagamento = outra data, para provar que a
    // consulta usa a data do PAI, nao da filha), filha com status 5 (Pendencia Paga) e seu
    // proprio detalhe_a/valor.
    async function seedPendenciaPagaFamily(): Promise<{ opaPaiId: number; opaFilhaId: number }> {
      const opaPaiId = T5_BASE_ID + 10;
      const opaFilhaId = T5_BASE_ID + 11;
      const orderId = T5_BASE_ID + 20;
      const historyId = T5_BASE_ID + 30;
      const detailId = T5_BASE_ID + 40;

      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-03-10', 500, NULL, now(), now())`,
        [opaPaiId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-01-01', 500, $2, now(), now())`,
        [opaFilhaId, opaPaiId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-01-01', 500, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
        [orderId, T5_USER_ID, opaFilhaId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
         VALUES ($1, $2, DATE '2020-01-01', '104', '0001', '99990002', '1', 5)`,
        [historyId, opaFilhaId],
      );
      await dataSource.query(
        `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, 996501, DATE '2020-01-01', 500, 500, 996501, now(), now())`,
        [detailId, historyId],
      );
      return { opaPaiId, opaFilhaId };
    }

    it('Pendencia Paga (familia): data vem do pai, valor da filha (ADR 0001)', async () => {
      await seedT5User();
      await seedPendenciaPagaFamily();

      const rows = await repository.findGroupedRows('permissionario', {
        dataInicio: new Date('2020-03-10T00:00:00.000Z'),
        dataFim: new Date('2020-03-10T00:00:00.000Z'),
        userIds: [T5_USER_ID],
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe(StatusPagamento.PENDENCIA_PAGA);
      expect(Number(rows[0].valor)).toBe(500);
    });

    it('Pendencia Paga (familia): consulta por intervalo tambem traz a linha, sem gate de dia unico (ADR 0001)', async () => {
      await seedT5User();
      await seedPendenciaPagaFamily();

      const rows = await repository.findGroupedRows('permissionario', {
        dataInicio: new Date('2020-03-01T00:00:00.000Z'),
        dataFim: new Date('2020-03-31T00:00:00.000Z'),
        userIds: [T5_USER_ID],
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe(StatusPagamento.PENDENCIA_PAGA);
    });

    it('Pendencia Paga sem pai (primeiro nivel) aparece pela propria data de pagamento', async () => {
      await seedT5User();
      const opaId = T5_BASE_ID + 110;
      const orderId = T5_BASE_ID + 120;
      const historyId = T5_BASE_ID + 130;
      const detailId = T5_BASE_ID + 140;

      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-04-10', 222, NULL, now(), now())`,
        [opaId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-04-01', 222, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
        [orderId, T5_USER_ID, opaId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
         VALUES ($1, $2, DATE '2020-04-01', '104', '0001', '99990002', '1', 5)`,
        [historyId, opaId],
      );
      await dataSource.query(
        `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, 996502, DATE '2020-04-01', 222, 222, 996502, now(), now())`,
        [detailId, historyId],
      );

      const rows = await repository.findGroupedRows('permissionario', {
        dataInicio: new Date('2020-04-10T00:00:00.000Z'),
        dataFim: new Date('2020-04-10T00:00:00.000Z'),
        userIds: [T5_USER_ID],
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe(StatusPagamento.PENDENCIA_PAGA);
      expect(Number(rows[0].valor)).toBe(222);
    });

    // Familia pai/filha, dia unico: pai rejeitado (status 4, motivo 'AR') define status/data;
    // valor vem da filha.
    async function seedRejeitadoFamiliaDiaUnico(): Promise<void> {
      const opaPaiId = T5_BASE_ID + 210;
      const opaFilhaId = T5_BASE_ID + 211;
      const orderId = T5_BASE_ID + 220;
      const historyPaiId = T5_BASE_ID + 230;
      const historyFilhaId = T5_BASE_ID + 231;
      const detailId = T5_BASE_ID + 240;

      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-05-10', 300, NULL, now(), now())`,
        [opaPaiId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-01-01', 300, $2, now(), now())`,
        [opaFilhaId, opaPaiId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-01-01', 300, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
        [orderId, T5_USER_ID, opaFilhaId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
         VALUES ($1, $2, DATE '2020-01-01', '104', '0001', '99990002', '1', 4, 'AR')`,
        [historyPaiId, opaPaiId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
         VALUES ($1, $2, DATE '2020-01-01', '104', '0001', '99990002', '1', 0)`,
        [historyFilhaId, opaFilhaId],
      );
      await dataSource.query(
        `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, 996503, DATE '2020-01-01', 300, 300, 996503, now(), now())`,
        [detailId, historyFilhaId],
      );
    }

    it('Rejeitado (familia, dia unico): status/data vem do historico mais recente do pai, valor da filha', async () => {
      await seedT5User();
      await seedRejeitadoFamiliaDiaUnico();

      const rows = await repository.findGroupedRows('permissionario', {
        dataInicio: new Date('2020-05-10T00:00:00.000Z'),
        dataFim: new Date('2020-05-10T00:00:00.000Z'),
        userIds: [T5_USER_ID],
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe(StatusPagamento.ERRO_REJEITADO);
      expect(Number(rows[0].valor)).toBe(300);
    });

    // Estorno sem pai (primeiro nivel), consulta de dia unico (ADR 0008).
    it('Estorno sem agrupamento pai aparece no filtro de dia unico (ADR 0008)', async () => {
      await seedT5User();
      const opaId = T5_BASE_ID + 310;
      const orderId = T5_BASE_ID + 320;
      const historyId = T5_BASE_ID + 330;
      const detailId = T5_BASE_ID + 340;

      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-06-10', 400, NULL, now(), now())`,
        [opaId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-06-01', 400, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
        [orderId, T5_USER_ID, opaId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
         VALUES ($1, $2, DATE '2020-06-01', '104', '0001', '99990002', '1', 4, '02')`,
        [historyId, opaId],
      );
      await dataSource.query(
        `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, 996504, DATE '2020-06-01', 400, 400, 996504, now(), now())`,
        [detailId, historyId],
      );

      const rows = await repository.findGroupedRows('permissionario', {
        dataInicio: new Date('2020-06-10T00:00:00.000Z'),
        dataFim: new Date('2020-06-10T00:00:00.000Z'),
        userIds: [T5_USER_ID],
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe(StatusPagamento.ERRO_ESTORNO);
      expect(Number(rows[0].valor)).toBe(400);
    });

    // ADR 0020: rejeicao com tentativa posterior bem sucedida nao conta mais como pendencia no
    // filtro de intervalo (nao e' mais a ultima tentativa do agrupamento).
    it('Rejeitado corrigido por pagamento posterior nao aparece no filtro de intervalo (ADR 0020)', async () => {
      await seedT5User();
      const opaId = T5_BASE_ID + 410;
      const orderId = T5_BASE_ID + 420;
      const rejectedHistoryId = T5_BASE_ID + 430;
      const rejectedDetailId = T5_BASE_ID + 440;
      const paidHistoryId = T5_BASE_ID + 431;
      const paidDetailId = T5_BASE_ID + 441;

      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-07-05', 777, NULL, now(), now())`,
        [opaId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, DATE '2020-07-01', 777, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
        [orderId, T5_USER_ID, opaId],
      );
      // Primeira tentativa: rejeitada, em 2020-07-01.
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
         VALUES ($1, $2, DATE '2020-07-01', '104', '0001', '99990002', '1', 4, 'AR')`,
        [rejectedHistoryId, opaId],
      );
      await dataSource.query(
        `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, 996505, DATE '2020-07-01', 777, 0, 996505, now(), now())`,
        [rejectedDetailId, rejectedHistoryId],
      );
      // Segunda tentativa: paga com sucesso, em 2020-07-05 (mesmo agrupamento).
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
         VALUES ($1, $2, DATE '2020-07-05', '104', '0001', '99990002', '1', 3, '00')`,
        [paidHistoryId, opaId],
      );
      await dataSource.query(
        `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, 996506, DATE '2020-07-05', 777, 777, 996506, now(), now())`,
        [paidDetailId, paidHistoryId],
      );

      // Intervalo (nao dia unico) cobrindo so a rejeicao original - orientado pela propria filha
      // (sem family lookup), com o filtro de elegibilidade do ADR 0020 por cima.
      const rows = await repository.findGroupedRows('permissionario', {
        dataInicio: new Date('2020-07-01T00:00:00.000Z'),
        dataFim: new Date('2020-07-02T00:00:00.000Z'),
        userIds: [T5_USER_ID],
      });

      expect(rows.filter((r) => r.status === StatusPagamento.ERRO_REJEITADO || r.status === StatusPagamento.ERRO_ESTORNO)).toHaveLength(0);
    });

    it('matches the legacy Permissionário service for Pendencia Paga total (family, single day)', async () => {
      await seedT5User();
      await seedPendenciaPagaFamily();

      const filter = {
        dataInicio: new Date('2020-03-10T00:00:00.000Z'),
        dataFim: new Date('2020-03-10T00:00:00.000Z'),
        userIds: [T5_USER_ID],
        consorcioNome: ['CONSORCIO TESTE'],
        pendenciaPaga: true,
      };

      const [newRows, legacySummary] = await Promise.all([
        repository.findGroupedRows('permissionario', {
          dataInicio: filter.dataInicio,
          dataFim: filter.dataFim,
          userIds: filter.userIds,
          consorcioNome: filter.consorcioNome,
          statuses: [StatusPagamento.PENDENCIA_PAGA],
        }),
        legacyPermissionarioService.findFinancialMovementSummary(filter),
      ]);

      const newTotal = newRows.reduce((acc, r) => acc + Number(r.valor), 0);
      expect(newTotal).toBe(legacySummary.valorPendenciaPaga);
      expect(legacySummary.valorPendenciaPaga).toBe(500);
    });

    it('matches the legacy Permissionário service for Rejeitado total (family, single day)', async () => {
      await seedT5User();
      await seedRejeitadoFamiliaDiaUnico();

      const filter = {
        dataInicio: new Date('2020-05-10T00:00:00.000Z'),
        dataFim: new Date('2020-05-10T00:00:00.000Z'),
        userIds: [T5_USER_ID],
        consorcioNome: ['CONSORCIO TESTE'],
        rejeitado: true,
      };

      const [newRows, legacySummary] = await Promise.all([
        repository.findGroupedRows('permissionario', {
          dataInicio: filter.dataInicio,
          dataFim: filter.dataFim,
          userIds: filter.userIds,
          consorcioNome: filter.consorcioNome,
          statuses: [StatusPagamento.ERRO_REJEITADO],
        }),
        legacyPermissionarioService.findFinancialMovementSummary(filter),
      ]);

      const newTotal = newRows.reduce((acc, r) => acc + Number(r.valor), 0);
      expect(newTotal).toBe(legacySummary.valorRejeitado);
      expect(legacySummary.valorRejeitado).toBe(300);
    });
  });
  // T3: filtro de Favorecido/Consorcio/Modal (ADR 2026-11-04, resolveConsorcioFilter).
  describe('Favorecido / Consorcio / Modal (T3)', () => {
    const T3_BASE_ID = 996300000;
    const T3_INSTITUTIONAL_USER_ID = T3_BASE_ID + 1;
    const T3_MODAL_USER_ID = T3_BASE_ID + 2;
    const T3_VLT_USER_ID = T3_BASE_ID + 3;

    afterEach(async () => {
      await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, [T3_BASE_ID, T3_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM public."user" WHERE id BETWEEN $1 AND $2`, [T3_BASE_ID, T3_BASE_ID + 999]);
    });

    // Institutional CNPJ favorecido (one of INSTITUTIONAL_CPF_CNPJ), raw nomeConsorcio
    // "Internorte" (no permitCode, falls to the ELSE branch of the CASE), plus a modal
    // favorecido (permitCode LIKE '4%' -> STPC).
    async function seedInstitutionalAndModalFavorecidos(): Promise<void> {
      await dataSource.query(
        `INSERT INTO public."user" (
          id, email, provider, "fullName", "roleId", "cpfCnpj",
          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'email', 'INSTITUCIONAL T3 TESTE', 1, '18201378000119',
          104, '0001', '99990002', '1', false, now(), now()
        )`,
        [T3_INSTITUTIONAL_USER_ID, `institucional-t3-${T3_INSTITUTIONAL_USER_ID}@example.test`],
      );
      await dataSource.query(
        `INSERT INTO public."user" (
          id, email, provider, "fullName", "roleId", "cpfCnpj", "permitCode",
          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'email', 'MODAL T3 TESTE', 1, '99999999701', '41234',
          104, '0001', '99990002', '1', false, now(), now()
        )`,
        [T3_MODAL_USER_ID, `modal-t3-${T3_MODAL_USER_ID}@example.test`],
      );

      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, DATE '2098-12-10', DATE '2098-12-10', 111, now(), $2, 'Internorte', NULL, now(), now())`,
        [T3_BASE_ID + 10, T3_INSTITUTIONAL_USER_ID],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, DATE '2098-12-10', DATE '2098-12-10', 222, now(), $2, 'RAW IGNORADO', NULL, now(), now())`,
        [T3_BASE_ID + 11, T3_MODAL_USER_ID],
      );
    }

    async function seedVltFavorecido(): Promise<void> {
      await dataSource.query(
        `INSERT INTO public."user" (
          id, email, provider, "fullName", "roleId", "cpfCnpj", "permitCode",
          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'email', 'VLT T3 TESTE', 1, '99999999702', '8',
          104, '0001', '99990002', '1', false, now(), now()
        )`,
        [T3_VLT_USER_ID, `vlt-t3-${T3_VLT_USER_ID}@example.test`],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, DATE '2098-12-15', DATE '2098-12-15', 777, now(), $2, 'RAW IGNORADO', NULL, now(), now())`,
        [T3_BASE_ID + 20, T3_VLT_USER_ID],
      );
    }

    const filterDates = { dataInicio: new Date('2098-12-10T00:00:00.000Z'), dataFim: new Date('2098-12-10T00:00:00.000Z') };

    it('"Favorecido = Todos" (nenhuma selecao) restringe a modais, excluindo CNPJ institucional e consorcio comum', async () => {
      await seedInstitutionalAndModalFavorecidos();

      const rows = await repository.findGroupedRows('permissionario', { ...filterDates });

      expect(rows).toHaveLength(1);
      expect(rows[0].nomeConsorcio).toBe('STPC');
      expect(Number(rows[0].valor)).toBe(222);
    });

    it('consorcio especifico inclui o CNPJ institucional daquele consorcio e exclui o modal de outro consorcio', async () => {
      await seedInstitutionalAndModalFavorecidos();

      const rows = await repository.findGroupedRows('permissionario', { ...filterDates, consorcioNome: ['Internorte'] });

      expect(rows).toHaveLength(1);
      expect(rows[0].nomeConsorcio).toBe('Internorte');
      expect(Number(rows[0].valor)).toBe(111);
    });

    it('"Todos os consorcios" inclui o CNPJ institucional e o modal juntos (regressao 2026-11-04)', async () => {
      await seedInstitutionalAndModalFavorecidos();

      const rows = await repository.findGroupedRows('permissionario', { ...filterDates, todosConsorcios: true });

      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.nomeConsorcio).sort()).toEqual(['Internorte', 'STPC']);
    });

    it('matches the legacy Permissionário service for a specific consorcio filter (VLT)', async () => {
      await seedVltFavorecido();

      const filter = {
        dataInicio: new Date('2098-12-15T00:00:00.000Z'),
        dataFim: new Date('2098-12-15T00:00:00.000Z'),
        userIds: [T3_VLT_USER_ID],
        consorcioNome: ['VLT'],
      };

      const [newRows, legacySummary] = await Promise.all([
        repository.findGroupedRows('permissionario', filter),
        legacyPermissionarioService.findFinancialMovementSummary(filter),
      ]);

      const newTotals = sumByStatus(newRows);
      expect(newTotals[StatusPagamento.A_PAGAR] ?? 0).toBe(legacySummary.valorAPagar);
      expect(legacySummary.valorAPagar).toBe(777);
    });

    it('Guardador: filtro so por userIds, sem distincao de modal/consorcio', async () => {
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
  });
  // T4 (AC-19/ADR 0002): keyset-cursor pagination for findGroupedRowsPage, for both profiles.
  // Dedicated ID range (996010000-996010999), distinct from BASE_ID above, and its own cleanup
  // scoped to that range only - this spec file is shared by several parallel tasks running
  // against the same local database (T6/T7/T8 also extend it), so this suite must never widen
  // the existing cleanFixtures() range or touch rows outside its own.
  describe('Keyset pagination (T4, AC-19)', () => {
    const BASE_ID_T4 = 996010000;
    const USER_ID_T4 = BASE_ID_T4 + 1;
    const GUARDADOR_USER_ID_T4 = BASE_ID_T4 + 2;

    async function cleanFixturesT4(): Promise<void> {
      if (!dataSource?.isInitialized) {
        return;
      }
      await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [BASE_ID_T4, BASE_ID_T4 + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, [BASE_ID_T4, BASE_ID_T4 + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, [BASE_ID_T4, BASE_ID_T4 + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_guardador WHERE id BETWEEN $1 AND $2`, [BASE_ID_T4, BASE_ID_T4 + 999]);
      await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, [BASE_ID_T4, BASE_ID_T4 + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [BASE_ID_T4, BASE_ID_T4 + 999]);
      await dataSource.query(`DELETE FROM public."user" WHERE id IN ($1, $2)`, [USER_ID_T4, GUARDADOR_USER_ID_T4]);
    }

    beforeEach(cleanFixturesT4);
    afterAll(cleanFixturesT4);

    async function seedPermissionarioUserT4(): Promise<void> {
      await dataSource.query(
        `INSERT INTO public."user" (
          id, email, provider, "fullName", "roleId", "cpfCnpj",
          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'email', 'PERMISSIONARIO V2 T4', 1, '99999999504',
          104, '0001', '99990002', '1', false, now(), now()
        )`,
        [USER_ID_T4, `permissionario-v2-t4-${USER_ID_T4}@example.test`],
      );
    }

    async function seedGuardadorUserT4(): Promise<void> {
      await dataSource.query(`INSERT INTO role (id, name) VALUES (6, 'agentes') ON CONFLICT (id) DO NOTHING`);
      await dataSource.query(
        `INSERT INTO public."user" (
          id, email, provider, "fullName", "roleId", "cpfCnpj",
          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'email', 'GUARDADOR V2 T4', 6, '99999999505',
          104, '0001', '99990002', '1', false, now(), now()
        )`,
        [GUARDADOR_USER_ID_T4, `guardador-v2-t4-${GUARDADOR_USER_ID_T4}@example.test`],
      );
    }

    // ADR 0002 scenario, verbatim: the same favorecido, paid (status 'Pago') on the same date,
    // under two different consórcios - a tie on the legacy 4-column cursor tuple
    // (dataReferencia, nomes, status, cpfCnpj), distinguished only by nomeConsorcio.
    async function seedPermissionarioTieFamily(): Promise<void> {
      const specs = [
        { opaId: BASE_ID_T4 + 10, orderId: BASE_ID_T4 + 11, historyId: BASE_ID_T4 + 12, detailId: BASE_ID_T4 + 13, nomeConsorcio: 'Intersul', valor: 111 },
        { opaId: BASE_ID_T4 + 20, orderId: BASE_ID_T4 + 21, historyId: BASE_ID_T4 + 22, detailId: BASE_ID_T4 + 23, nomeConsorcio: 'Transcarioca', valor: 222 },
      ];

      for (const s of specs) {
        await dataSource.query(
          `INSERT INTO ordem_pagamento_agrupado (
            id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
          ) VALUES ($1, DATE '2098-11-10', $2, NULL, now(), now())`,
          [s.opaId, s.valor],
        );
        await dataSource.query(
          `INSERT INTO ordem_pagamento (
            id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
          ) VALUES ($1, DATE '2098-11-05', $2, now(), $3, $4, $5, now(), now())`,
          [s.orderId, s.valor, USER_ID_T4, s.nomeConsorcio, s.opaId],
        );
        await dataSource.query(
          `INSERT INTO ordem_pagamento_agrupado_historico (
            id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
            "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
          ) VALUES ($1, $2, DATE '2098-11-10', '104', '0001', '99990002', '1', 3, '00')`,
          [s.historyId, s.opaId],
        );
        await dataSource.query(
          `INSERT INTO detalhe_a (
            id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
            "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
            "createdAt", "updatedAt"
          ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, DATE '2098-11-10', $4, $4, $3, now(), now())`,
          [s.detailId, s.historyId, s.detailId, s.valor],
        );
      }
    }

    // Guardador has no nomeConsorcio dimension (always NULL, see NOME_CONSORCIO_AGRUPADA), so
    // two agrupamentos on the same day/status for the same guardador legitimately collapse into
    // one summed row (agrupada_somada) - not a tie. The equivalent real tie for this profile is
    // in "nunca_enviada" (ADR 0017: no aggregation there): two distinct never-grouped orders,
    // same day/status, distinguished only by valor (the cursor's 6th column).
    async function seedGuardadorTieFamily(): Promise<void> {
      const specs = [
        { orderId: BASE_ID_T4 + 110, valor: 333 },
        { orderId: BASE_ID_T4 + 111, valor: 444 },
      ];
      for (const s of specs) {
        await dataSource.query(
          `INSERT INTO ordem_pagamento_guardador (
            id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId",
            "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
            "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida",
            "createdAt", "updatedAt"
          ) VALUES ($1, DATE '2098-11-10', DATE '2098-11-10', $2, $3, 'AUTOMATICA', NULL, 0, 0, 0, now(), now())`,
          [s.orderId, s.valor, GUARDADOR_USER_ID_T4],
        );
      }
    }

    // Walk every page from an empty cursor until nextCursor is null, collecting all rows.
    async function collectAllPages(
      perfil: 'permissionario' | 'guardador',
      filter: Record<string, unknown>,
      pageSize: number,
    ) {
      const pages: (typeof repository extends never ? never : any)[] = [];
      let cursor: any;
      let safety = 0;
      do {
        const page = await repository.findGroupedRowsPage(perfil, filter as any, pageSize, cursor);
        pages.push(page);
        cursor = page.nextCursor ?? undefined;
        safety += 1;
        if (safety > 200) {
          throw new Error('Too many pages - possible infinite pagination loop');
        }
      } while (cursor);
      return pages;
    }

    function rowKey(row: { dataReferencia: unknown; nomes: unknown; cpfCnpj: unknown; nomeConsorcio: unknown; status: unknown; valor: unknown }): string {
      return [row.dataReferencia, row.nomes, row.cpfCnpj, row.nomeConsorcio, row.status, Number(row.valor)].join('|');
    }

    it('loses no row and duplicates no row across pages, landing mid-tie on the legacy 4-column tuple (Permissionario, ADR 0002)', async () => {
      await seedPermissionarioUserT4();
      await seedPermissionarioTieFamily();

      const filter = {
        dataInicio: new Date('2098-11-10T00:00:00.000Z'),
        dataFim: new Date('2098-11-10T00:00:00.000Z'),
        userIds: [USER_ID_T4],
      };

      const unpaginated = await repository.findGroupedRows('permissionario', filter);
      expect(unpaginated).toHaveLength(2);

      const pages = await collectAllPages('permissionario', filter, 1);
      const paginatedRows = pages.flatMap((p) => p.rows);

      expect(paginatedRows).toHaveLength(2);
      expect(new Set(paginatedRows.map(rowKey))).toEqual(new Set(unpaginated.map(rowKey)));
      expect(pages[pages.length - 1].nextCursor).toBeNull();
    });

    it('loses no row and duplicates no row across pages, landing mid-tie distinguished only by valor (Guardador)', async () => {
      await seedGuardadorUserT4();
      await seedGuardadorTieFamily();

      const filter = {
        dataInicio: new Date('2098-11-10T00:00:00.000Z'),
        dataFim: new Date('2098-11-10T00:00:00.000Z'),
      };

      const unpaginated = await repository.findGroupedRows('guardador', filter);
      expect(unpaginated).toHaveLength(2);

      const pages = await collectAllPages('guardador', filter, 1);
      const paginatedRows = pages.flatMap((p) => p.rows);

      expect(paginatedRows).toHaveLength(2);
      expect(new Set(paginatedRows.map(rowKey))).toEqual(new Set(unpaginated.map(rowKey)));
      expect(pages[pages.length - 1].nextCursor).toBeNull();
    });

    async function seedManyNuncaEnviada(perfil: 'permissionario' | 'guardador', userId: number, count: number): Promise<void> {
      for (let i = 0; i < count; i += 1) {
        const orderId = BASE_ID_T4 + 500 + i;
        const valor = 1 + i;
        const day = 11 + (i % 10); // spread across 10 distinct days, several orders per day
        const data = `2099-01-${String(day).padStart(2, '0')}`;
        if (perfil === 'permissionario') {
          await dataSource.query(
            `INSERT INTO ordem_pagamento (
              id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
            ) VALUES ($1, $2::date, $2::date, $3, now(), $4, 'CONSORCIO TESTE T4', NULL, now(), now())`,
            [orderId, data, valor, userId],
          );
        } else {
          await dataSource.query(
            `INSERT INTO ordem_pagamento_guardador (
              id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId",
              "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
              "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida",
              "createdAt", "updatedAt"
            ) VALUES ($1, $2::date, $2::date, $3, $4, 'AUTOMATICA', NULL, 0, 0, 0, now(), now())`,
            [orderId, data, valor, userId],
          );
        }
      }
    }

    it.each(['permissionario', 'guardador'] as const)(
      'walking all pages with varied pageSize (%s) equals the unpaginated result exactly, over 55 rows',
      async (perfil) => {
        if (perfil === 'permissionario') {
          await seedPermissionarioUserT4();
          await seedManyNuncaEnviada('permissionario', USER_ID_T4, 55);
        } else {
          await seedGuardadorUserT4();
          await seedManyNuncaEnviada('guardador', GUARDADOR_USER_ID_T4, 55);
        }

        const filter = {
          dataInicio: new Date('2099-01-11T00:00:00.000Z'),
          dataFim: new Date('2099-01-20T00:00:00.000Z'),
          userIds: [perfil === 'permissionario' ? USER_ID_T4 : GUARDADOR_USER_ID_T4],
        };

        const unpaginated = await repository.findGroupedRows(perfil, filter);
        expect(unpaginated).toHaveLength(55);

        for (const pageSize of [7, 13, 55, 100]) {
          const pages = await collectAllPages(perfil, filter, pageSize);
          const paginatedRows = pages.flatMap((p) => p.rows);

          expect(paginatedRows.map(rowKey)).toEqual(unpaginated.map(rowKey));
          expect(pages[pages.length - 1].nextCursor).toBeNull();
          // Every page but the last must be exactly pageSize (no short/empty intermediate pages).
          pages.slice(0, -1).forEach((p) => expect(p.rows).toHaveLength(pageSize));
        }
      },
    );

    it('page N cursor fetches exactly page N+1 (not page N again, no skipped rows)', async () => {
      await seedPermissionarioUserT4();
      await seedManyNuncaEnviada('permissionario', USER_ID_T4, 25);

      const filter = {
        dataInicio: new Date('2099-01-11T00:00:00.000Z'),
        dataFim: new Date('2099-01-20T00:00:00.000Z'),
        userIds: [USER_ID_T4],
      };

      const unpaginated = await repository.findGroupedRows('permissionario', filter);
      const pageSize = 10;

      const page1 = await repository.findGroupedRowsPage('permissionario', filter, pageSize);
      expect(page1.rows.map(rowKey)).toEqual(unpaginated.slice(0, 10).map(rowKey));
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await repository.findGroupedRowsPage('permissionario', filter, pageSize, page1.nextCursor ?? undefined);
      expect(page2.rows.map(rowKey)).toEqual(unpaginated.slice(10, 20).map(rowKey));
      expect(page2.nextCursor).not.toBeNull();

      const page3 = await repository.findGroupedRowsPage('permissionario', filter, pageSize, page2.nextCursor ?? undefined);
      expect(page3.rows.map(rowKey)).toEqual(unpaginated.slice(20, 25).map(rowKey));
      expect(page3.nextCursor).toBeNull();
    });

    it('returns exactly pageSize rows and a null nextCursor when the dataset size equals pageSize exactly', async () => {
      await seedPermissionarioUserT4();
      // seedManyNuncaEnviada spreads rows across 10 distinct days; seeding exactly 5 rows keeps
      // the dataset itself at exactly pageSize, which is the boundary this test targets.
      await seedManyNuncaEnviada('permissionario', USER_ID_T4, 5);

      const filter = {
        dataInicio: new Date('2099-01-11T00:00:00.000Z'),
        dataFim: new Date('2099-01-20T00:00:00.000Z'),
        userIds: [USER_ID_T4],
      };

      const unpaginated = await repository.findGroupedRows('permissionario', filter);
      expect(unpaginated).toHaveLength(5);

      const page = await repository.findGroupedRowsPage('permissionario', filter, 5);

      expect(page.rows).toHaveLength(5);
      expect(page.rows.map(rowKey)).toEqual(unpaginated.map(rowKey));
      expect(page.nextCursor).toBeNull();
    });

    it('returns an empty page (no rows, null nextCursor) for an empty dataset', async () => {
      await seedPermissionarioUserT4();

      const page = await repository.findGroupedRowsPage(
        'permissionario',
        {
          dataInicio: new Date('2099-01-11T00:00:00.000Z'),
          dataFim: new Date('2099-01-20T00:00:00.000Z'),
          userIds: [USER_ID_T4],
        },
        10,
      );

      expect(page.rows).toHaveLength(0);
      expect(page.nextCursor).toBeNull();
    });
  });
  // T7 (AC-11, ADR 0004/0019): Eleição, single payment, payer CETT, Permissionário only. Own id
  // range (coordinator instruction, 2026-11-09): other parallel tasks' fixtures live in
  // BASE_ID/T5_BASE_ID above - this block only ever touches T7_BASE_ID..+999.
  //
  // Finding: this local test database has no "ordem_pagamento_unico" table at all (confirmed
  // via information_schema.tables) - it is populated externally in real environments (the
  // table is only ever read from, never INSERTed into, anywhere else in this codebase). The
  // minimal columns actually read by findEleicaoRows/buildEleicaoQuery are created here,
  // idempotently (IF NOT EXISTS), the same pattern already used by seedGuardadorUser above for
  // the missing "agentes" role - not a migration, since this repo does not own that table's
  // real schema.
  describe('Eleição (T7)', () => {
    const T7_BASE_ID = 996030000;
    const T7_USER_ID = T7_BASE_ID + 1;
    const T7_USER_FALLBACK_ID = T7_BASE_ID + 2;
    const T7_USER_DUP_A_ID = T7_BASE_ID + 3;
    const T7_USER_DUP_B_ID = T7_BASE_ID + 4;

    beforeAll(async () => {
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS ordem_pagamento_unico (
          id SERIAL PRIMARY KEY,
          "idOrdemPagamento" VARCHAR,
          "idOperadora" VARCHAR,
          "operadoraCpfCnpj" VARCHAR,
          "operadora" VARCHAR,
          "consorcio" VARCHAR,
          "dataOrdem" DATE,
          "quantidadeTransacaoGratuidade" INTEGER,
          "valorTotalTransacaoLiquido" NUMERIC
        )
      `);
    });

    afterEach(async () => {
      await dataSource.query(`DELETE FROM ordem_pagamento_unico WHERE "idOrdemPagamento"::bigint BETWEEN $1 AND $2`, [T7_BASE_ID, T7_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [T7_BASE_ID, T7_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, [T7_BASE_ID, T7_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [T7_BASE_ID, T7_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM public."user" WHERE id BETWEEN $1 AND $2`, [T7_BASE_ID, T7_BASE_ID + 999]);
    });

    async function seedEleicaoUser(id: number, cpfCnpj: string, permitCode: string | null, fullName: string): Promise<void> {
      await dataSource.query(
        `INSERT INTO public."user" (
          id, email, provider, "fullName", "roleId", "cpfCnpj", "permitCode",
          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'email', $3, 1, $4, $5,
          104, '0001', '99990002', '1', false, now(), now()
        )`,
        [id, `eleicao-v2-${id}@example.test`, fullName, cpfCnpj, permitCode],
      );
    }

    // opaId/historyId/detailId/opuId all derived from a single seed id, inside T7_BASE_ID range.
    async function seedEleicaoOrder(params: {
      seedId: number;
      dataVencimento: string;
      valor: number;
      statusRemessa: number;
      motivoStatusRemessa?: string | null;
      idOperadora: string | null;
      operadoraCpfCnpj: string | null;
      consorcio?: string;
    }): Promise<void> {
      // All four derived ids must stay within T7_BASE_ID..+999 (afterEach's cleanup range) -
      // a *10 spacing per seedId leaves room for the four without crossing into the next
      // seedId's block.
      const opaId = T7_BASE_ID + params.seedId * 10;
      const historyId = T7_BASE_ID + params.seedId * 10 + 1;
      const detailId = T7_BASE_ID + params.seedId * 10 + 2;
      const opuId = T7_BASE_ID + params.seedId * 10 + 3;

      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, $2::date, $3, NULL, now(), now())`,
        [opaId, params.dataVencimento, params.valor],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (
          id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
          "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
        ) VALUES ($1, $2, $3::date, '104', '0001', '99990002', '1', $4, $5)`,
        [historyId, opaId, params.dataVencimento, params.statusRemessa, params.motivoStatusRemessa ?? null],
      );
      await dataSource.query(
        `INSERT INTO detalhe_a (
          id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
          "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
          "createdAt", "updatedAt"
        ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $1, $3::date, $4, $4, $1, now(), now())`,
        [detailId, historyId, params.dataVencimento, params.valor],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_unico (id, "idOrdemPagamento", "idOperadora", "operadoraCpfCnpj", "consorcio", "dataOrdem")
         VALUES ($1, $2, $3, $4, $5, $6::date)`,
        [opuId, String(opaId), params.idOperadora, params.operadoraCpfCnpj, params.consorcio ?? 'ELEICAO CONSORCIO TESTE', params.dataVencimento],
      );
    }

    it('joins by permitCode/idOperadora as the primary match, no fallback needed', async () => {
      await seedEleicaoUser(T7_USER_ID, '99999999701', 'ELEC-PC-1', 'ELEICAO PRIMARY TESTE');
      await seedEleicaoOrder({
        seedId: 10,
        dataVencimento: '2098-12-10',
        valor: 500,
        statusRemessa: 0,
        idOperadora: 'ELEC-PC-1',
        operadoraCpfCnpj: '00000000000', // cpfCnpj diferente do do usuario - prova que nao foi o fallback que resolveu.
      });

      const rows = await repository.findEleicaoRows({
        dataInicio: new Date('2098-12-10T00:00:00.000Z'),
        dataFim: new Date('2098-12-10T00:00:00.000Z'),
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].nomes).toBe('ELEICAO PRIMARY TESTE');
      expect(Number(rows[0].valor)).toBe(500);
      expect(rows[0].status).toBe(StatusPagamento.A_PAGAR);
    });

    // Reproduz o caso real de nov/2024 (ADR 0019): ordem sem idOperadora preenchido.
    it('falls back to cpfCnpj when idOperadora has no match, reproducing the nov/2024 case', async () => {
      await seedEleicaoUser(T7_USER_FALLBACK_ID, '99999999702', null, 'ELEICAO FALLBACK TESTE');
      await seedEleicaoOrder({
        seedId: 11,
        dataVencimento: '2098-12-11',
        valor: 400,
        statusRemessa: 1,
        idOperadora: null,
        operadoraCpfCnpj: '99999999702',
      });

      const rows = await repository.findEleicaoRows({
        dataInicio: new Date('2098-12-11T00:00:00.000Z'),
        dataFim: new Date('2098-12-11T00:00:00.000Z'),
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].nomes).toBe('ELEICAO FALLBACK TESTE');
      expect(Number(rows[0].valor)).toBe(400);
    });

    // Constraint: a duplicate CPF among users must never reintroduce fan-out - the fallback only
    // runs when permitCode genuinely has no match, which isn't the case here.
    it('does not trigger the cpfCnpj fallback (no fan-out) when permitCode already matches, even with a duplicate CPF in "user"', async () => {
      await seedEleicaoUser(T7_USER_DUP_A_ID, '99999999703', 'ELEC-PC-DUP', 'ELEICAO DUP A TESTE');
      await seedEleicaoUser(T7_USER_DUP_B_ID, '99999999703', 'ELEC-PC-OTHER', 'ELEICAO DUP B TESTE');
      await seedEleicaoOrder({
        seedId: 12,
        dataVencimento: '2098-12-12',
        valor: 700,
        statusRemessa: 0,
        idOperadora: 'ELEC-PC-DUP', // so' bate com o usuario A.
        operadoraCpfCnpj: '99999999703', // bate com A e B (CPF duplicado).
      });

      const rows = await repository.findEleicaoRows({
        dataInicio: new Date('2098-12-12T00:00:00.000Z'),
        dataFim: new Date('2098-12-12T00:00:00.000Z'),
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].nomes).toBe('ELEICAO DUP A TESTE');
      expect(Number(rows[0].valor)).toBe(700);
    });

    // Edge case: nem permitCode nem cpfCnpj resolvem - a ordem nao deve aparecer, nao travar a query.
    it('does not appear (and does not error) when neither idOperadora nor cpfCnpj match any user', async () => {
      await seedEleicaoOrder({
        seedId: 13,
        dataVencimento: '2098-12-13',
        valor: 999,
        statusRemessa: 0,
        idOperadora: 'NAO-EXISTE',
        operadoraCpfCnpj: '00000000000',
      });

      const rows = await repository.findEleicaoRows({
        dataInicio: new Date('2098-12-13T00:00:00.000Z'),
        dataFim: new Date('2098-12-13T00:00:00.000Z'),
      });

      expect(rows).toHaveLength(0);
    });

    // ADR 0004: Eleição's status bucket set is restricted - statusRemessa=5 has no own bucket
    // here (unlike the shared buildStatusPagamentoCaseSql), so it falls to the final ELSE
    // ('Rejeitado'). statusRemessa 0/1 must still land on 'A Pagar', not that same ELSE fallback
    // (the historical bug documented at ELEICAO_STATUS_CASE, found 19/10/2026).
    it('restricted status set: statusRemessa=5 falls to Rejeitado (no Pendencia Paga bucket for Eleição)', async () => {
      await seedEleicaoUser(T7_USER_ID, '99999999701', 'ELEC-PC-1', 'ELEICAO STATUS5 TESTE');
      await seedEleicaoOrder({
        seedId: 14,
        dataVencimento: '2098-12-14',
        valor: 150,
        statusRemessa: 5,
        idOperadora: 'ELEC-PC-1',
        operadoraCpfCnpj: '99999999701',
      });

      const rows = await repository.findEleicaoRows({
        dataInicio: new Date('2098-12-14T00:00:00.000Z'),
        dataFim: new Date('2098-12-14T00:00:00.000Z'),
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe(StatusPagamento.ERRO_REJEITADO);
    });

    // Parity (Test-First Plan item 5): totals per status bucket must match buildEleicaoQuery
    // (via the legacy service, filter.eleicao=true) for the same fixtures, across the join
    // scenarios above (primary match, fallback, duplicate-CPF-no-fan-out).
    it('matches the legacy Eleição totals per status bucket (primary join + cpfCnpj fallback + duplicate-CPF safety)', async () => {
      await seedEleicaoUser(T7_USER_ID, '99999999701', 'ELEC-PC-1', 'ELEICAO PRIMARY TESTE');
      await seedEleicaoUser(T7_USER_FALLBACK_ID, '99999999702', null, 'ELEICAO FALLBACK TESTE');
      await seedEleicaoUser(T7_USER_DUP_A_ID, '99999999703', 'ELEC-PC-DUP', 'ELEICAO DUP A TESTE');
      await seedEleicaoUser(T7_USER_DUP_B_ID, '99999999703', 'ELEC-PC-OTHER', 'ELEICAO DUP B TESTE');
      await seedEleicaoOrder({ seedId: 10, dataVencimento: '2098-12-10', valor: 500, statusRemessa: 0, idOperadora: 'ELEC-PC-1', operadoraCpfCnpj: '00000000000' });
      await seedEleicaoOrder({ seedId: 11, dataVencimento: '2098-12-11', valor: 400, statusRemessa: 1, idOperadora: null, operadoraCpfCnpj: '99999999702' });
      await seedEleicaoOrder({ seedId: 12, dataVencimento: '2098-12-12', valor: 700, statusRemessa: 0, idOperadora: 'ELEC-PC-DUP', operadoraCpfCnpj: '99999999703' });

      // userIds (em vez de todosVanzeiros) evita o MODAIS_FILTER/NOT_CPF_FILTER do legado (so'
      // pensado para "Favorecido = Todos" sem nenhum usuario especifico, restrito a
      // permitCode LIKE '4%'/'81%'/'7%' - nao se aplica aos permitCodes sinteticos deste
      // fixture).
      const filter = {
        dataInicio: new Date('2098-12-01T00:00:00.000Z'),
        dataFim: new Date('2098-12-31T00:00:00.000Z'),
        eleicao: true,
        userIds: [T7_USER_ID, T7_USER_FALLBACK_ID, T7_USER_DUP_A_ID],
      };

      const [newRows, legacySummary] = await Promise.all([
        repository.findEleicaoRows(filter),
        legacyPermissionarioService.findFinancialMovementSummary(filter),
      ]);

      const newTotals = sumByStatus(newRows);
      expect(newTotals[StatusPagamento.A_PAGAR] ?? 0).toBe(legacySummary.valorAPagar);
      expect(legacySummary.valorAPagar).toBe(1600);
    });
  });
  // T6 (ADR 0021/AC-18): "Pendentes" (OPs atrasadas) - exatamente a elegibilidade que a
  // geracao real de remessa usa pra decidir o que reprocessar (regras-pendencia.ts, nunca
  // reescrita). Datas relativas a CURRENT_DATE/hoje (nao fixas no passado/futuro como as
  // demais fixtures deste arquivo), porque as funcoes de elegibilidade comparam contra
  // CURRENT_DATE e contra "hoje" em horario de Brasilia.
  //
  // Dedicated id range (996020000..996020999), distinto do resto do arquivo e dos outros
  // agentes paralelos (T4/T7/T8) que compartilham este mesmo arquivo/banco de teste local -
  // ver aviso do orquestrador.
  describe('Pendentes (T6)', () => {
    const T6_BASE_ID = 996020000;
    const T6_USER_ID = T6_BASE_ID + 1;
    const T6_GUARDADOR_USER_ID = T6_BASE_ID + 2;

    afterEach(async () => {
      await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [T6_BASE_ID, T6_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, [T6_BASE_ID, T6_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, [T6_BASE_ID, T6_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_guardador WHERE id BETWEEN $1 AND $2`, [T6_BASE_ID, T6_BASE_ID + 999]);
      await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, [T6_BASE_ID, T6_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [T6_BASE_ID, T6_BASE_ID + 999]);
      await dataSource.query(`DELETE FROM public."user" WHERE id IN ($1, $2)`, [T6_USER_ID, T6_GUARDADOR_USER_ID]);
    });

    async function seedT6User(): Promise<void> {
      await dataSource.query(
        `INSERT INTO public."user" (
          id, email, provider, "fullName", "roleId", "cpfCnpj",
          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'email', 'PERMISSIONARIO T6 TESTE', 1, '99999999701',
          104, '0001', '99990002', '1', false, now(), now()
        )`,
        [T6_USER_ID, `permissionario-t6-${T6_USER_ID}@example.test`],
      );
    }

    async function seedT6GuardadorUser(): Promise<void> {
      await dataSource.query(`INSERT INTO role (id, name) VALUES (6, 'agentes') ON CONFLICT (id) DO NOTHING`);
      await dataSource.query(
        `INSERT INTO public."user" (
          id, email, provider, "fullName", "roleId", "cpfCnpj",
          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'email', 'GUARDADOR T6 TESTE', 6, '99999999702',
          104, '0001', '99990002', '1', false, now(), now()
        )`,
        [T6_GUARDADOR_USER_ID, `guardador-t6-${T6_GUARDADOR_USER_ID}@example.test`],
      );
    }

    // Wide window covering everything these fixtures insert via "CURRENT_DATE - INTERVAL" -
    // not boundary-sensitive itself, so JS/SQL clock skew of a few hours does not matter here.
    const wideFilterWindow = () => ({
      dataInicio: new Date(Date.now() - 60 * 24 * 3600 * 1000),
      dataFim: new Date(),
    });

    // This local test database has no pagador seeded for conta=ContaRotativo (only CETT/
    // ContaBilhetagem exist in pagadorSeedData) - reused across agents/runs (not deleted in
    // afterEach): it is a harmless, permanent reference row, never touched by this task's
    // BASE_ID cleanup range.
    async function ensurePagadorRotativoId(): Promise<number> {
      const conta = '000566697069'; // PagadorContaEnum.ContaRotativo
      await dataSource.query(
        `INSERT INTO pagador ("nomeEmpresa", conta)
         SELECT 'PAGADOR ROTATIVO TESTE', $1::varchar
         WHERE NOT EXISTS (SELECT 1 FROM pagador WHERE conta = $1::varchar)`,
        [conta],
      );
      const [{ id }] = await dataSource.query(`SELECT id FROM pagador WHERE conta = $1::varchar LIMIT 1`, [conta]);
      return id;
    }

    // Behavior 1 (permissionario): ordem solta capturada ha mais de 10 dias -> Pendentes.
    it('a loose order captured more than 10 days ago appears as Pendentes, for Permissionario', async () => {
      await seedT6User();
      const orderId = T6_BASE_ID + 10;
      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, (CURRENT_DATE - INTERVAL '20 days'), (CURRENT_DATE - INTERVAL '20 days'), 111, now(), $2, 'CONSORCIO TESTE', NULL, now(), now())`,
        [orderId, T6_USER_ID],
      );

      const rows = await repository.findGroupedRows('permissionario', { ...wideFilterWindow(), userIds: [T6_USER_ID] });

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe(StatusPagamento.PENDENTES);
      expect(Number(rows[0].valor)).toBe(111);
    });

    // Behavior 1 (guardador): guardador nao tem o corte explicito de 10 dias (so' "antes de
    // hoje", dentro da janela pedida - regras-pendencia.ts, pendenciaOrdemSoltaGuardador), mas
    // uma ordem solta de mais de 10 dias atras deve igualmente aparecer.
    it('a loose order captured more than 10 days ago appears as Pendentes, for Guardador', async () => {
      await seedT6GuardadorUser();
      const orderId = T6_BASE_ID + 240;
      await dataSource.query(
        `INSERT INTO ordem_pagamento_guardador (
          id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId",
          "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
          "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida",
          "createdAt", "updatedAt"
        ) VALUES ($1, (CURRENT_DATE - INTERVAL '20 days'), (CURRENT_DATE - INTERVAL '20 days'), 222, $2, 'AUTOMATICA', NULL, 0, 0, 0, now(), now())`,
        [orderId, T6_GUARDADOR_USER_ID],
      );

      const rows = await repository.findGroupedRows('guardador', wideFilterWindow());

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe(StatusPagamento.PENDENTES);
      expect(Number(rows[0].valor)).toBe(222);
    });

    // Behavior 2 (permissionario): rejeicao real do banco (statusRemessa=4, motivo fora de
    // AM/00/BD, valor<>0, sem historico de pagamento bem sucedido) -> Pendentes.
    async function seedPermissionarioRejeitado(motivoStatusRemessa: string, valor: number): Promise<void> {
      const opaId = T6_BASE_ID + 20 + valor;
      const orderId = T6_BASE_ID + 21 + valor;
      const historyId = T6_BASE_ID + 22 + valor;
      const detailId = T6_BASE_ID + 23 + valor;

      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, (CURRENT_DATE - INTERVAL '5 days'), $2, NULL, now(), now())`,
        [opaId, valor],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento (id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, (CURRENT_DATE - INTERVAL '5 days'), (CURRENT_DATE - INTERVAL '5 days'), $2, now(), $3, 'CONSORCIO TESTE', $4, now(), now())`,
        [orderId, valor, T6_USER_ID, opaId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
         VALUES ($1, $2, (CURRENT_DATE - INTERVAL '5 days'), '104', '0001', '99990002', '1', 4, $3)`,
        [historyId, opaId, motivoStatusRemessa],
      );
      await dataSource.query(
        `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, (CURRENT_DATE - INTERVAL '5 days'), $4, 0, $3, now(), now())`,
        [detailId, historyId, 996020000 + valor, valor],
      );
    }

    it('a genuinely rejected order (reason outside AM/00/BD, value<>0, no success history) appears as Pendentes, for Permissionario', async () => {
      await seedT6User();
      await seedPermissionarioRejeitado('AR', 231);

      const rows = await repository.findGroupedRows('permissionario', { ...wideFilterWindow(), userIds: [T6_USER_ID] });

      const pendentes = rows.filter((r) => r.status === StatusPagamento.PENDENTES);
      expect(pendentes).toHaveLength(1);
      expect(Number(pendentes[0].valor)).toBe(231);
    });

    it.each([
      ['sem filtro de status', undefined],
      ['Pendentes + Rejeitado', [StatusPagamento.PENDENTES, StatusPagamento.ERRO_REJEITADO]],
    ])('counts an eligible rejected lot once, %s', async (_caso, statuses) => {
      await seedT6User();
      await seedPermissionarioRejeitado('AR', 233);

      const rows = await repository.findGroupedRows('permissionario', { ...wideFilterWindow(), userIds: [T6_USER_ID], statuses });

      expect(rows.reduce((total, r) => total + Number(r.valor), 0)).toBe(233);
    });

    // ADR 0023 (T10): sem Pendentes no filtro, o lote rejeitado elegivel continua aparecendo como Rejeitado.
    it('keeps an eligible rejected lot as Rejeitado when Pendentes is not selected', async () => {
      await seedT6User();
      await seedPermissionarioRejeitado('AR', 234);

      const rows = await repository.findGroupedRows('permissionario', { ...wideFilterWindow(), userIds: [T6_USER_ID], statuses: [StatusPagamento.ERRO_REJEITADO] });

      expect(rows.map((r) => [r.status, Number(r.valor)])).toEqual([[StatusPagamento.ERRO_REJEITADO, 234]]);
    });

    // Behavior 3 (permissionario): mesma rejeicao, mas com motivo em AM/00/BD (nao e' rejeicao
    // real) -> NAO aparece em Pendentes.
    it('a rejected order whose reason IS in AM/00/BD does NOT appear as Pendentes, for Permissionario', async () => {
      await seedT6User();
      await seedPermissionarioRejeitado('AM', 232);

      const rows = await repository.findGroupedRows('permissionario', { ...wideFilterWindow(), userIds: [T6_USER_ID] });

      expect(rows.filter((r) => r.status === StatusPagamento.PENDENTES)).toHaveLength(0);
      expect(rows.some((r) => Number(r.valor) === 232)).toBe(false);
    });

    // Behavior 2 (guardador): mesma regra de rejeicao real, perfil Guardador.
    it('a genuinely rejected order (reason outside AM/00/BD, value<>0, no success history) appears as Pendentes, for Guardador', async () => {
      await seedT6GuardadorUser();
      const opaId = T6_BASE_ID + 250;
      const orderId = T6_BASE_ID + 251;
      const historyId = T6_BASE_ID + 252;
      const detailId = T6_BASE_ID + 253;

      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, (CURRENT_DATE - INTERVAL '5 days'), 333, NULL, now(), now())`,
        [opaId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_guardador (
          id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId",
          "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
          "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida",
          "createdAt", "updatedAt"
        ) VALUES ($1, (CURRENT_DATE - INTERVAL '5 days'), (CURRENT_DATE - INTERVAL '5 days'), 333, $2, 'AUTOMATICA', $3, 0, 0, 0, now(), now())`,
        [orderId, T6_GUARDADOR_USER_ID, opaId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
         VALUES ($1, $2, (CURRENT_DATE - INTERVAL '5 days'), '104', '0001', '99990002', '1', 4, 'AR')`,
        [historyId, opaId],
      );
      await dataSource.query(
        `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, 996020333, (CURRENT_DATE - INTERVAL '5 days'), 333, 0, 996020333, now(), now())`,
        [detailId, historyId],
      );

      const rows = await repository.findGroupedRows('guardador', wideFilterWindow());

      const pendentes = rows.filter((r) => r.status === StatusPagamento.PENDENTES);
      expect(pendentes).toHaveLength(1);
      expect(Number(pendentes[0].valor)).toBe(333);
    });

    // Behavior 4 (guardador apenas - regras-pendencia.ts nao tem funcao equivalente para
    // Permissionario, achado reportado na task): agrupamento criado e nunca enviado (so'
    // historico "Criado"/statusRemessa=0, sem detalhe_a) -> Pendentes.
    it('a grouping created and never sent appears as Pendentes, for Guardador', async () => {
      await seedT6GuardadorUser();
      const pagadorId = await ensurePagadorRotativoId();
      const opaId = T6_BASE_ID + 260;
      const orderId = T6_BASE_ID + 261;
      const historyId = T6_BASE_ID + 262;

      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "pagadorId", "createdAt", "updatedAt")
         VALUES ($1, (CURRENT_DATE - INTERVAL '5 days'), 444, NULL, $2, now(), now())`,
        [opaId, pagadorId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_guardador (
          id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId",
          "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
          "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida",
          "createdAt", "updatedAt"
        ) VALUES ($1, (CURRENT_DATE - INTERVAL '5 days'), (CURRENT_DATE - INTERVAL '5 days'), 444, $2, 'AUTOMATICA', $3, 0, 0, 0, now(), now())`,
        [orderId, T6_GUARDADOR_USER_ID, opaId],
      );
      // Historico "Criado" (statusRemessa=0) apenas - nunca foi enviado (nenhum detalhe_a).
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
         VALUES ($1, $2, (CURRENT_DATE - INTERVAL '5 days'), '104', '0001', '99990002', '1', 0)`,
        [historyId, opaId],
      );

      const rows = await repository.findGroupedRows('guardador', wideFilterWindow());

      const pendentes = rows.filter((r) => r.status === StatusPagamento.PENDENTES);
      expect(pendentes).toHaveLength(1);
      expect(Number(pendentes[0].valor)).toBe(444);
    });

    // Edge case: ordem com equivalente (mesmo usuario/dia/valor) ja paga ou em andamento em
    // outro agrupamento - nao deve contar como pendente de novo.
    it('a loose order with an equivalent already paid/in progress does NOT appear as Pendentes', async () => {
      await seedT6User();
      const looseOrderId = T6_BASE_ID + 270;
      const equivalentOrderId = T6_BASE_ID + 271;
      const opaId = T6_BASE_ID + 272;
      const historyId = T6_BASE_ID + 273;

      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, (CURRENT_DATE - INTERVAL '20 days'), (CURRENT_DATE - INTERVAL '20 days'), 555, now(), $2, 'CONSORCIO TESTE', NULL, now(), now())`,
        [looseOrderId, T6_USER_ID],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, (CURRENT_DATE - INTERVAL '20 days'), 555, NULL, now(), now())`,
        [opaId],
      );
      // Equivalente: mesmo usuario, mesmo dia (dataCaptura), mesmo valor, ja agrupado com
      // historico "em andamento" (statusRemessa=1) - fn_ordem_pagamento_ja_paga_ou_em_andamento
      // passa a acusar o looseOrderId como ja' coberto.
      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, (CURRENT_DATE - INTERVAL '20 days'), (CURRENT_DATE - INTERVAL '20 days'), 555, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
        [equivalentOrderId, T6_USER_ID, opaId],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
         VALUES ($1, $2, (CURRENT_DATE - INTERVAL '20 days'), '104', '0001', '99990002', '1', 1)`,
        [historyId, opaId],
      );
      // fn_ordem_pagamento_ja_paga_ou_em_andamento exige um detalhe_a no historico do
      // equivalente (INNER JOIN) - sem ele a funcao nao o conta como "em andamento".
      const detailId = T6_BASE_ID + 274;
      await dataSource.query(
        `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, (CURRENT_DATE - INTERVAL '20 days'), 555, 0, $3, now(), now())`,
        [detailId, historyId, 996020274],
      );

      const rows = await repository.findGroupedRows('permissionario', { ...wideFilterWindow(), userIds: [T6_USER_ID] });

      expect(rows.filter((r) => r.status === StatusPagamento.PENDENTES)).toHaveLength(0);
    });

    // Edge case: janela de 10 dias exatamente na fronteira - capturada ha exatamente 10 dias
    // ainda entra (<=); ha 9 dias ainda nao entra.
    it('includes an order captured exactly 10 days ago but not one captured 9 days ago, for Permissionario', async () => {
      await seedT6User();
      const tenDaysOrderId = T6_BASE_ID + 280;
      const nineDaysOrderId = T6_BASE_ID + 281;

      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, (CURRENT_DATE - INTERVAL '10 days'), (CURRENT_DATE - INTERVAL '10 days'), 611, now(), $2, 'CONSORCIO TESTE', NULL, now(), now())`,
        [tenDaysOrderId, T6_USER_ID],
      );
      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, (CURRENT_DATE - INTERVAL '9 days'), (CURRENT_DATE - INTERVAL '9 days'), 612, now(), $2, 'CONSORCIO TESTE', NULL, now(), now())`,
        [nineDaysOrderId, T6_USER_ID],
      );

      const rows = await repository.findGroupedRows('permissionario', { ...wideFilterWindow(), userIds: [T6_USER_ID] });
      const valores = rows.filter((r) => r.status === StatusPagamento.PENDENTES).map((r) => Number(r.valor));

      expect(valores).toContain(611);
      expect(valores).not.toContain(612);
    });

    // Behavior 5 (paridade entre os dois perfis): a mesma elegibilidade (loose + rejeitado)
    // aplicada aos dois perfis soma corretamente quando combinada no mesmo filtro - garante que
    // nenhuma fonte (ordem solta/rejeitado) se perde nem duplica quando as duas aparecem juntas
    // no bucket Pendentes, em qualquer um dos perfis.
    it('sums loose-order and rejected-order Pendentes together without loss or duplication, for both profiles', async () => {
      await seedT6User();
      const looseOrderId = T6_BASE_ID + 290;
      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, (CURRENT_DATE - INTERVAL '20 days'), (CURRENT_DATE - INTERVAL '20 days'), 701, now(), $2, 'CONSORCIO TESTE', NULL, now(), now())`,
        [looseOrderId, T6_USER_ID],
      );
      await seedPermissionarioRejeitado('AR', 702);

      const permissionarioRows = await repository.findGroupedRows('permissionario', { ...wideFilterWindow(), userIds: [T6_USER_ID] });
      const permissionarioTotal = permissionarioRows
        .filter((r) => r.status === StatusPagamento.PENDENTES)
        .reduce((acc, r) => acc + Number(r.valor), 0);
      expect(permissionarioTotal).toBe(701 + 702);

      await seedT6GuardadorUser();
      const looseGuardadorOrderId = T6_BASE_ID + 291;
      const pagadorId = await ensurePagadorRotativoId();
      await dataSource.query(
        `INSERT INTO ordem_pagamento_guardador (
          id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId",
          "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
          "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida",
          "createdAt", "updatedAt"
        ) VALUES ($1, (CURRENT_DATE - INTERVAL '20 days'), (CURRENT_DATE - INTERVAL '20 days'), 801, $2, 'AUTOMATICA', NULL, 0, 0, 0, now(), now())`,
        [looseGuardadorOrderId, T6_GUARDADOR_USER_ID],
      );
      const opaId = T6_BASE_ID + 292;
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "pagadorId", "createdAt", "updatedAt")
         VALUES ($1, (CURRENT_DATE - INTERVAL '5 days'), 802, NULL, $2, now(), now())`,
        [opaId, pagadorId],
      );
      const nuncaEnviadoOrderId = T6_BASE_ID + 293;
      await dataSource.query(
        `INSERT INTO ordem_pagamento_guardador (
          id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId",
          "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
          "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida",
          "createdAt", "updatedAt"
        ) VALUES ($1, (CURRENT_DATE - INTERVAL '5 days'), (CURRENT_DATE - INTERVAL '5 days'), 802, $2, 'AUTOMATICA', $3, 0, 0, 0, now(), now())`,
        [nuncaEnviadoOrderId, T6_GUARDADOR_USER_ID, opaId],
      );
      const historyId = T6_BASE_ID + 294;
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
         VALUES ($1, $2, (CURRENT_DATE - INTERVAL '5 days'), '104', '0001', '99990002', '1', 0)`,
        [historyId, opaId],
      );

      const guardadorRows = await repository.findGroupedRows('guardador', wideFilterWindow());
      const guardadorTotal = guardadorRows
        .filter((r) => r.status === StatusPagamento.PENDENTES)
        .reduce((acc, r) => acc + Number(r.valor), 0);
      expect(guardadorTotal).toBe(801 + 802);
    });
  });

  // Fixtures dos itens A1-A4 (faixa 985000000-985000999, limpeza so' desta faixa).
  describe('Fechamento v2 (A1-A4)', () => {
    const A_BASE = 985000000;
    const periodo = { dataInicio: new Date('2098-03-10T00:00:00.000Z'), dataFim: new Date('2098-03-10T00:00:00.000Z') };

    async function cleanFixturesA(): Promise<void> {
      await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [A_BASE, A_BASE + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, [A_BASE, A_BASE + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, [A_BASE, A_BASE + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_guardador WHERE id BETWEEN $1 AND $2`, [A_BASE, A_BASE + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_unico WHERE id BETWEEN $1 AND $2`, [A_BASE, A_BASE + 999]);
      await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, [A_BASE, A_BASE + 999]);
      await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [A_BASE, A_BASE + 999]);
      await dataSource.query(`DELETE FROM user_relationships WHERE user_id BETWEEN $1 AND $2 OR related_user_id BETWEEN $1 AND $2`, [A_BASE, A_BASE + 999]);
      await dataSource.query(`DELETE FROM public."user" WHERE id BETWEEN $1 AND $2`, [A_BASE, A_BASE + 999]);
    }

    beforeEach(cleanFixturesA);
    afterAll(cleanFixturesA);

    async function seedUsuario(params: { id: number; nome: string; cpf: string; bloqueado?: boolean; roleId?: number; permitCode?: string | null }): Promise<void> {
      await dataSource.query(`INSERT INTO role (id, name) VALUES (6, 'agentes') ON CONFLICT (id) DO NOTHING`);
      await dataSource.query(
        `INSERT INTO public."user" (
          id, email, provider, "fullName", "roleId", "cpfCnpj", "permitCode",
          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, 'email', $3, $4, $5, $6, 104, '0001', '99990002', '1', $7, now(), now())`,
        [params.id, `rv2-${params.id}@example.test`, params.nome, params.roleId ?? 1, params.cpf, params.permitCode ?? null, params.bloqueado ?? false],
      );
    }

    async function seedOrdemSolta(params: { id: number; valor: number; userId: number | null; consorcio?: string; data?: string }): Promise<void> {
      const data = params.data ?? '2098-03-10';
      await dataSource.query(
        `INSERT INTO ordem_pagamento (id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, $2::date, $2::date, $3, now(), $4, $5, NULL, now(), now())`,
        [params.id, data, params.valor, params.userId, params.consorcio ?? 'RV2 CONSORCIO'],
      );
    }

    // Agrupamento com historico e detalhe_a; a ordem filha liga o favorecido (ou o guardador).
    async function seedAgrupado(params: { base: number; userId: number; statusRemessa: number; motivo?: string | null; valor: number; data?: string; perfil?: 'permissionario' | 'guardador' }): Promise<void> {
      const data = params.data ?? '2098-03-10';
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
         VALUES ($1, $2::date, $3, NULL, now(), now())`,
        [params.base, data, params.valor],
      );
      if (params.perfil === 'guardador') {
        await seedOrdemGuardador({ id: params.base + 1, valor: params.valor, userId: params.userId, data, opaId: params.base });
      } else {
        await dataSource.query(
          `INSERT INTO ordem_pagamento (id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
           VALUES ($1, $2::date, $2::date, $3, now(), $4, 'RV2 CONSORCIO', $5, now(), now())`,
          [params.base + 1, data, params.valor, params.userId, params.base],
        );
      }
      await dataSource.query(
        `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
         VALUES ($1, $2, $3::date, '104', '0001', '99990002', '1', $4, $5)`,
        [params.base + 2, params.base, data, params.statusRemessa, params.motivo ?? null],
      );
      await dataSource.query(
        `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, $1, $3::date, $4, $4, $1, now(), now())`,
        [params.base + 3, params.base + 2, data, params.valor],
      );
    }

    async function seedOrdemGuardador(params: { id: number; valor: number; userId: number | null; data?: string; opaId?: number | null }): Promise<void> {
      const data = params.data ?? '2098-03-10';
      await dataSource.query(
        `INSERT INTO ordem_pagamento_guardador (id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId", "tipoOrdemPagamento", "ordemPagamentoAgrupadoId", "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida", "createdAt", "updatedAt")
         VALUES ($1, $2::date, $2::date, $3, $4, 'AUTOMATICA', $5, 0, 0, 0, now(), now())`,
        [params.id, data, params.valor, params.userId, params.opaId ?? null],
      );
    }

    type Filtro = Parameters<BasePagamentoRepository['findGroupedRowsPage']>[1];

    async function percorrer(perfil: 'permissionario' | 'guardador', filtro: Filtro, pageSize: number) {
      const linhas: Awaited<ReturnType<BasePagamentoRepository['findGroupedRows']>> = [];
      let cursor: Parameters<BasePagamentoRepository['findGroupedRowsPage']>[3];
      for (let pagina = 0; pagina < 50; pagina += 1) {
        const resultado = await repository.findGroupedRowsPage(perfil, filtro, pageSize, cursor);
        linhas.push(...resultado.rows);
        if (!resultado.nextCursor) return linhas;
        cursor = resultado.nextCursor;
      }
      throw new Error('paginacao nao terminou em 50 paginas');
    }

    describe('A1: chave estavel por linha', () => {
      const filtroConsorcio = { ...periodo, consorcioNome: ['RV2 CONSORCIO'] };

      it('returns two orders identical on every cursor column, paging with pageSize 1', async () => {
        await seedOrdemSolta({ id: A_BASE + 1, valor: 77, userId: null });
        await seedOrdemSolta({ id: A_BASE + 2, valor: 77, userId: null });

        const linhas = await percorrer('permissionario', filtroConsorcio, 1);

        expect(linhas).toHaveLength(2);
        expect(new Set(linhas.map((linha) => linha.chaveLinha)).size).toBe(2);
      });

      it('does not lose a row without a favorecido that sorts after a named one (NULL handling)', async () => {
        await seedUsuario({ id: A_BASE + 10, nome: 'RV2 NOMEADO', cpf: '98500000010' });
        await seedOrdemSolta({ id: A_BASE + 3, valor: 10, userId: A_BASE + 10 });
        await seedOrdemSolta({ id: A_BASE + 4, valor: 20, userId: null });

        const linhas = await percorrer('permissionario', filtroConsorcio, 1);

        expect(linhas.map((linha) => Number(linha.valor)).sort((a, b) => a - b)).toEqual([10, 20]);
      });

      it('keeps one row per history when a never-sent order fans out (key is per emitted row)', async () => {
        const opaId = A_BASE + 100;
        await dataSource.query(
          `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
           VALUES ($1, DATE '2098-03-10', 33, NULL, now(), now())`,
          [opaId],
        );
        await dataSource.query(
          `INSERT INTO ordem_pagamento (id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
           VALUES ($1, DATE '2098-03-10', DATE '2098-03-10', 33, now(), NULL, 'RV2 CONSORCIO', $2, now(), now())`,
          [A_BASE + 5, opaId],
        );
        for (const offset of [101, 102]) {
          await dataSource.query(
            `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
             VALUES ($1, $2, DATE '2098-03-10', '104', '0001', '99990002', '1', 0)`,
            [A_BASE + offset, opaId],
          );
        }

        const [completo, paginado] = await Promise.all([repository.findGroupedRows('permissionario', filtroConsorcio), percorrer('permissionario', filtroConsorcio, 1)]);

        expect(paginado).toHaveLength(completo.length);
        expect(new Set(paginado.map((linha) => linha.chaveLinha)).size).toBe(paginado.length);
      });

      it('a cursor without the key keeps the previous behaviour (no error, no repeated row)', async () => {
        await seedOrdemSolta({ id: A_BASE + 1, valor: 77, userId: null });
        await seedOrdemSolta({ id: A_BASE + 2, valor: 88, userId: null });

        const primeira = await repository.findGroupedRowsPage('permissionario', filtroConsorcio, 1);
        const semChave = { ...(primeira.nextCursor as NonNullable<typeof primeira.nextCursor>), chaveLinha: undefined };
        const segunda = await repository.findGroupedRowsPage('permissionario', filtroConsorcio, 1, semChave);

        expect(segunda.rows.map((linha) => Number(linha.valor))).toEqual([88]);
        expect(segunda.nextCursor).toBeNull();
      });

      it('round-trips the key through the request cursor', async () => {
        await seedOrdemSolta({ id: A_BASE + 1, valor: 77, userId: null });
        await seedOrdemSolta({ id: A_BASE + 2, valor: 77, userId: null });

        const primeira = await repository.findGroupedRowsPage('permissionario', filtroConsorcio, 1);
        const c = primeira.nextCursor as NonNullable<typeof primeira.nextCursor>;
        const cursor = resolveCursorFromQuery({
          ...filtroConsorcio,
          cursorDataReferencia: c.dataReferencia as string,
          cursorNomeConsorcio: c.nomeConsorcio ?? undefined,
          cursorStatus: c.status ?? undefined,
          cursorValor: c.valor === null ? undefined : String(c.valor),
          cursorChaveLinha: c.chaveLinha ?? undefined,
        });
        const segunda = await repository.findGroupedRowsPage('permissionario', filtroConsorcio, 1, cursor);

        expect(segunda.rows).toHaveLength(1);
        expect(segunda.rows[0].chaveLinha).not.toBe(primeira.rows[0].chaveLinha);
      });
    });

    describe('A2: favorecido bloqueado', () => {
      const BLOQUEADO = A_BASE + 200;
      const ATIVO = A_BASE + 201;

      beforeEach(async () => {
        await seedUsuario({ id: BLOQUEADO, nome: 'RV2 BLOQUEADO', cpf: '98500000200', bloqueado: true });
        await seedUsuario({ id: ATIVO, nome: 'RV2 ATIVO', cpf: '98500000201' });
      });

      const noPeriodo = (desativados?: boolean) => ({ ...periodo, consorcioNome: ['RV2 CONSORCIO'], desativados });

      it('hides a blocked favorecido by default and shows only blocked ones under desativados (never-grouped A Pagar)', async () => {
        await seedOrdemSolta({ id: A_BASE + 210, valor: 11, userId: BLOQUEADO });
        await seedOrdemSolta({ id: A_BASE + 211, valor: 22, userId: ATIVO });

        const padrao = await repository.findGroupedRows('permissionario', noPeriodo());
        const desativados = await repository.findGroupedRows('permissionario', noPeriodo(true));

        expect(padrao.map((linha) => linha.nomes)).toEqual(['RV2 ATIVO']);
        expect(desativados.map((linha) => linha.nomes)).toEqual(['RV2 BLOQUEADO']);
      });

      it.each([
        ['Pago', 3, null],
        ['Pendencia Paga', 5, null],
        ['Rejeitado (dia unico)', 4, 'XX'],
      ])('applies to the %s source', async (_nome, statusRemessa, motivo) => {
        await seedAgrupado({ base: A_BASE + 220, userId: BLOQUEADO, statusRemessa, motivo, valor: 33 });

        const padrao = await repository.findGroupedRows('permissionario', { ...periodo, userIds: [BLOQUEADO] });
        const desativados = await repository.findGroupedRows('permissionario', { ...periodo, userIds: [BLOQUEADO], desativados: true });

        expect(padrao).toHaveLength(0);
        expect(desativados).toHaveLength(1);
      });

      it('applies to the Pendentes source (loose order older than 10 days, past date)', async () => {
        const hoje = new Date();
        const data = new Date(hoje.getTime() - 20 * 86400000).toISOString().slice(0, 10);
        const janela = { dataInicio: new Date(`${data}T00:00:00.000Z`), dataFim: new Date(`${data}T00:00:00.000Z`), userIds: [BLOQUEADO], statuses: [StatusPagamento.PENDENTES] };
        await seedOrdemSolta({ id: A_BASE + 230, valor: 44, userId: BLOQUEADO, data });

        const padrao = await repository.findGroupedRows('permissionario', janela);
        const desativados = await repository.findGroupedRows('permissionario', { ...janela, desativados: true });

        expect(padrao).toHaveLength(0);
        expect(desativados.map((linha) => Number(linha.valor))).toEqual([44]);
      });

      it('applies to Guardador', async () => {
        await seedUsuario({ id: A_BASE + 202, nome: 'RV2 GUARDADOR BLOQUEADO', cpf: '98500000202', bloqueado: true, roleId: 6 });
        await seedOrdemGuardador({ id: A_BASE + 240, valor: 55, userId: A_BASE + 202 });

        const padrao = await repository.findGroupedRows('guardador', { ...periodo, userIds: [A_BASE + 202] });
        const desativados = await repository.findGroupedRows('guardador', { ...periodo, userIds: [A_BASE + 202], desativados: true });

        expect(padrao).toHaveLength(0);
        expect(desativados).toHaveLength(1);
      });

      it('keeps orders with no user visible by default and out of desativados', async () => {
        await seedOrdemSolta({ id: A_BASE + 250, valor: 66, userId: null });

        const padrao = await repository.findGroupedRows('permissionario', noPeriodo());
        const desativados = await repository.findGroupedRows('permissionario', noPeriodo(true));

        expect(padrao).toHaveLength(1);
        expect(desativados).toHaveLength(0);
      });

      it('matches the legacy totals for a blocked favorecido on a grouped source (default and desativados)', async () => {
        await seedAgrupado({ base: A_BASE + 260, userId: BLOQUEADO, statusRemessa: 3, valor: 12 });
        const filtro = { ...periodo, userIds: [BLOQUEADO] };

        const [novoPadrao, legadoPadrao, novoDesativados, legadoDesativados] = await Promise.all([
          repository.findGroupedRows('permissionario', filtro),
          legacyPermissionarioService.findFinancialMovementSummary(filtro),
          repository.findGroupedRows('permissionario', { ...filtro, desativados: true }),
          legacyPermissionarioService.findFinancialMovementSummary({ ...filtro, desativados: true }),
        ]);

        expect(sumByStatus(novoPadrao)[StatusPagamento.PAGO] ?? 0).toBe(legadoPadrao.valorPago);
        expect(sumByStatus(novoDesativados)[StatusPagamento.PAGO] ?? 0).toBe(legadoDesativados.valorPago);
        expect(legadoDesativados.valorPago).toBe(12);
      }, 30000);

      // Divergencia documentada: buildAPagarNuncaEnviadoQuery do legado exclui bloqueado sempre,
      // mesmo em desativados; a v2 segue a regra "desativados mostra so os bloqueados".
      it('shows a blocked never-grouped order under desativados, where the legacy never does', async () => {
        await seedOrdemSolta({ id: A_BASE + 210, valor: 11, userId: BLOQUEADO });
        const filtro = { ...periodo, userIds: [BLOQUEADO] };

        const [novoPadrao, legadoPadrao, novoDesativados, legadoDesativados] = await Promise.all([
          repository.findGroupedRows('permissionario', filtro),
          legacyPermissionarioService.findFinancialMovementSummary(filtro),
          repository.findGroupedRows('permissionario', { ...filtro, desativados: true }),
          legacyPermissionarioService.findFinancialMovementSummary({ ...filtro, desativados: true }),
        ]);

        expect(sumByStatus(novoPadrao)[StatusPagamento.A_PAGAR] ?? 0).toBe(legadoPadrao.valorAPagar);
        expect(sumByStatus(novoDesativados)[StatusPagamento.A_PAGAR]).toBe(11);
        expect(legadoDesativados.valorAPagar).toBe(0);
      }, 30000);
    });

    describe('A3: filtro de associacao do Guardador', () => {
      const ASSOC_A = A_BASE + 300;
      const ASSOC_B = A_BASE + 301;
      const G_A = A_BASE + 302;
      const G_B = A_BASE + 303;
      const G_SEM = A_BASE + 304;
      const G_ASSOC_A_2 = A_BASE + 305;

      beforeEach(async () => {
        await seedUsuario({ id: ASSOC_A, nome: 'RV2 ANGLAE', cpf: '98500000300' });
        await seedUsuario({ id: ASSOC_B, nome: 'RV2 SINGAERJ', cpf: '98500000301' });
        await seedUsuario({ id: G_A, nome: 'RV2 G ANGLAE', cpf: '98500000302', roleId: 6, permitCode: 'RV2-PERMIT-A' });
        await seedUsuario({ id: G_B, nome: 'RV2 G SINGAERJ', cpf: '98500000303', roleId: 6, permitCode: 'RV2-PERMIT-B' });
        await seedUsuario({ id: G_SEM, nome: 'RV2 G AUTONOMO', cpf: '98500000304', roleId: 6, permitCode: 'RV2-PERMIT-C' });
        await seedUsuario({ id: G_ASSOC_A_2, nome: 'RV2 G ANGLAE 2', cpf: '98500000305', roleId: 6, permitCode: 'RV2-PERMIT-D' });
        await dataSource.query(`INSERT INTO user_relationships (user_id, related_user_id) VALUES ($1, $2), ($3, $4), ($5, $2)`, [G_A, ASSOC_A, G_B, ASSOC_B, G_ASSOC_A_2]);
        await seedOrdemGuardador({ id: A_BASE + 310, valor: 300, userId: G_A });
        await seedOrdemGuardador({ id: A_BASE + 311, valor: 400, userId: G_B });
        await seedOrdemGuardador({ id: A_BASE + 312, valor: 500, userId: G_SEM });
        // Pagamento da propria associacao: entra com o filtro de associacao, nunca em "Todos os guardadores".
        await seedOrdemGuardador({ id: A_BASE + 313, valor: 900, userId: ASSOC_A });
      });

      const nomes = (linhas: { nomes: string }[]) => linhas.map((linha) => linha.nomes).sort();

      // Regra de Rayanne (2026-11-13): selecting associations brings their guardadores AND the association's own
      // payment; "Todos os guardadores" (no association filter) never brings the association's own payment.
      it('consorcioNome keeps the guardadores of that association and its own payment, case-insensitive', async () => {
        const linhas = await repository.findGroupedRows('guardador', { ...periodo, consorcioNome: [' rv2 anglae '] });

        expect(nomes(linhas)).toEqual(['RV2 ANGLAE', 'RV2 G ANGLAE']);
        expect(linhas.find((linha) => linha.nomes === 'RV2 G ANGLAE')?.nomeConsorcio).toBe('RV2 ANGLAE');
      });

      it('consorcioNome does not bring the own payment of another association', async () => {
        const linhas = await repository.findGroupedRows('guardador', { ...periodo, consorcioNome: ['RV2 SINGAERJ'] });

        expect(nomes(linhas)).toEqual(['RV2 G SINGAERJ']);
      });

      it('todosConsorcios keeps every guardador with an association and the associations own payments', async () => {
        const linhas = await repository.findGroupedRows('guardador', { ...periodo, todosConsorcios: true });

        expect(nomes(linhas)).toEqual(['RV2 ANGLAE', 'RV2 G ANGLAE', 'RV2 G SINGAERJ']);
      });

      it('applies to grouped sources too (detalhe_a path, through the LATERAL)', async () => {
        await seedAgrupado({ base: A_BASE + 320, userId: G_B, statusRemessa: 3, valor: 77, perfil: 'guardador' });

        const linhas = await repository.findGroupedRows('guardador', { ...periodo, consorcioNome: ['RV2 ANGLAE'], statuses: [StatusPagamento.PAGO] });
        const singaerj = await repository.findGroupedRows('guardador', { ...periodo, consorcioNome: ['RV2 SINGAERJ'], statuses: [StatusPagamento.PAGO] });

        expect(linhas).toHaveLength(0);
        expect(singaerj.map((linha) => Number(linha.valor))).toEqual([77]);
      });

      it('valorMin is by favorecido for Guardador even under an association filter (decision)', async () => {
        await seedOrdemGuardador({ id: A_BASE + 314, valor: 300, userId: G_ASSOC_A_2 });

        const linhas = await repository.findGroupedRows('guardador', { ...periodo, consorcioNome: ['RV2 ANGLAE'], valorMin: 500 });

        // Guardadores of 300 each drop out; the association's own payment (900) passes the minimum.
        expect(nomes(linhas)).toEqual(['RV2 ANGLAE']);
      });

      it('valorMax applies to the association own payment too', async () => {
        await seedOrdemGuardador({ id: A_BASE + 316, valor: 300, userId: G_ASSOC_A_2 });

        const linhas = await repository.findGroupedRows('guardador', { ...periodo, consorcioNome: ['RV2 ANGLAE'], valorMax: 500 });

        expect(nomes(linhas)).toEqual(['RV2 G ANGLAE', 'RV2 G ANGLAE 2']);
      });

      // "Todos os guardadores" (no association filter) is the guardadores' value only: the association's own
      // payment row is left out, so Todos os guardadores and Todas as associacoes give different totals.
      it('with no association filter, keeps every guardador and leaves out the association own payment', async () => {
        const linhas = await repository.findGroupedRows('guardador', periodo);

        expect(nomes(linhas)).toEqual(['RV2 G ANGLAE', 'RV2 G AUTONOMO', 'RV2 G SINGAERJ']);
      });

      it('with no association filter, a guardador order with no user is left out, as in the legacy', async () => {
        await seedOrdemGuardador({ id: A_BASE + 315, valor: 15, userId: null });

        const linhas = await repository.findGroupedRows('guardador', periodo);

        expect(linhas.some((linha) => linha.nomes === null)).toBe(false);
      });
      it.each([
        ['consorcioNome', { consorcioNome: ['RV2 ANGLAE'] }],
        ['todosConsorcios', { todosConsorcios: true }],
      ])('is the legacy Guardador total plus the association own payment (%s, documented divergence)', async (_nome, extra) => {
        const filtro = { ...periodo, ...extra };

        const [novo, legado] = await Promise.all([repository.findGroupedRows('guardador', filtro), legacyGuardadorRepository.findFinancialMovementSummary(filtro)]);

        // The legacy never brings the association's own payment (RV2 ANGLAE, 900).
        expect(sumByStatus(novo)[StatusPagamento.A_PAGAR] ?? 0).toBe(legado.valorAPagar + 900);
      }, 30000);
    });

    describe('A4: findEleicaoRows', () => {
      const U_MODAL = A_BASE + 400;
      const U_COMUM = A_BASE + 401;
      const U_BLOQ = A_BASE + 402;

      async function seedEleicao(params: { base: number; idOperadora: string; cpf: string; consorcio: string; valor: number }): Promise<void> {
        await dataSource.query(
          `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
           VALUES ($1, DATE '2098-03-10', $2, NULL, now(), now())`,
          [params.base, params.valor],
        );
        await dataSource.query(
          `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
           VALUES ($1, $2, DATE '2098-03-10', '104', '0001', '99990002', '1', 3)`,
          [params.base + 1, params.base],
        );
        await dataSource.query(
          `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
           OVERRIDING SYSTEM VALUE VALUES ($1, $2, $1, DATE '2098-03-10', $3, $3, $1, now(), now())`,
          [params.base + 2, params.base + 1, params.valor],
        );
        await dataSource.query(
          `INSERT INTO ordem_pagamento_unico (id, "idOrdemPagamento", "idOperadora", "operadoraCpfCnpj", "consorcio", "dataOrdem")
           VALUES ($1, $2, $3, $4, $5, DATE '2098-03-10')`,
          [params.base + 3, String(params.base), params.idOperadora, params.cpf, params.consorcio],
        );
      }

      beforeAll(async () => {
        await dataSource.query(`
          CREATE TABLE IF NOT EXISTS ordem_pagamento_unico (
            id SERIAL PRIMARY KEY, "idOrdemPagamento" VARCHAR, "idOperadora" VARCHAR, "operadoraCpfCnpj" VARCHAR,
            "operadora" VARCHAR, "consorcio" VARCHAR, "dataOrdem" DATE, "quantidadeTransacaoGratuidade" INTEGER, "valorTotalTransacaoLiquido" NUMERIC
          )
        `);
      });

      beforeEach(async () => {
        await seedUsuario({ id: U_MODAL, nome: 'RV2 ELEICAO MODAL', cpf: '98500000400', permitCode: '4RV2001' });
        await seedUsuario({ id: U_COMUM, nome: 'RV2 ELEICAO COMUM', cpf: '98500000401', permitCode: 'RV2-E-COMUM' });
        await seedUsuario({ id: U_BLOQ, nome: 'RV2 ELEICAO BLOQ', cpf: '98500000402', permitCode: 'RV2-E-BLOQ', bloqueado: true });
        await seedEleicao({ base: A_BASE + 410, idOperadora: '4RV2001', cpf: '98500000400', consorcio: 'RV2 RAW', valor: 100 });
        await seedEleicao({ base: A_BASE + 420, idOperadora: 'RV2-E-COMUM', cpf: '98500000401', consorcio: 'Internorte', valor: 200 });
        await seedEleicao({ base: A_BASE + 430, idOperadora: 'RV2-E-BLOQ', cpf: '98500000402', consorcio: 'Internorte', valor: 300 });
      });

      it('resolves the consorcio by permitCode first, matching the legacy consolidado for a permitCode starting with 4', async () => {
        const legacyConsolidado = new RelatorioNovoRemessaConsolidadoRepository(dataSource);

        const [linhas, legado] = await Promise.all([
          repository.findEleicaoRows({ ...periodo, consorcioNome: ['STPC'] }),
          legacyConsolidado.findConsolidado({ ...periodo, eleicao: true, consorcioNome: ['STPC'] }),
        ]);

        expect(linhas.map((linha) => linha.nomeConsorcio)).toEqual(['STPC']);
        expect(legado.data.reduce((total, linha) => total + Number(linha.valor), 0)).toBe(100);
      }, 30000);

      it('filters by the CASE-resolved consorcio, unlike the legacy Movimentacao that compares the raw column (documented divergence)', async () => {
        const [v2Stpc, legadoStpc, v2Raw, legadoRaw] = await Promise.all([
          repository.findEleicaoRows({ ...periodo, consorcioNome: ['STPC'] }),
          legacyPermissionarioService.findFinancialMovementSummary({ ...periodo, eleicao: true, consorcioNome: ['STPC'] }),
          repository.findEleicaoRows({ ...periodo, consorcioNome: ['RV2 RAW'] }),
          legacyPermissionarioService.findFinancialMovementSummary({ ...periodo, eleicao: true, consorcioNome: ['RV2 RAW'] }),
        ]);

        expect(v2Stpc.reduce((total, linha) => total + Number(linha.valor), 0)).toBe(100);
        expect(legadoStpc.valorPago).toBe(0);
        expect(v2Raw).toHaveLength(0);
        expect(legadoRaw.valorPago).toBe(100);
      }, 30000);

      it('todosConsorcios keeps the fixed CONSORCIOS list, resolved by the CASE (legacy compares the raw column: documented divergence)', async () => {
        await seedEleicao({ base: A_BASE + 440, idOperadora: 'RV2-E-COMUM', cpf: '98500000401', consorcio: 'RV2 FORA DA LISTA', valor: 50 });
        const legacyConsolidado = new RelatorioNovoRemessaConsolidadoRepository(dataSource);

        const [linhas, legado] = await Promise.all([
          repository.findEleicaoRows({ ...periodo, todosConsorcios: true }),
          legacyConsolidado.findConsolidado({ ...periodo, eleicao: true, todosConsorcios: true }),
        ]);

        expect(linhas.map((linha) => Number(linha.valor)).sort((a, b) => a - b)).toEqual([100, 200]);
        expect(legado.data.reduce((total, linha) => total + Number(linha.valor), 0)).toBe(200);
      }, 30000);

      it('restricts by userIds', async () => {
        const linhas = await repository.findEleicaoRows({ ...periodo, userIds: [U_COMUM] });

        expect(linhas.map((linha) => linha.nomes)).toEqual(['RV2 ELEICAO COMUM']);
      });

      it('excludes a blocked favorecido by default and shows only blocked ones under desativados', async () => {
        const [padrao, desativados] = await Promise.all([repository.findEleicaoRows(periodo), repository.findEleicaoRows({ ...periodo, desativados: true })]);

        expect(padrao.map((linha) => linha.nomes)).not.toContain('RV2 ELEICAO BLOQ');
        expect(desativados.map((linha) => linha.nomes)).toEqual(['RV2 ELEICAO BLOQ']);
      });
    });
  });
});
