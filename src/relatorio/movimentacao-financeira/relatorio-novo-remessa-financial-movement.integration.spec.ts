/**
 * Permissionário financial movement coverage against a disposable PostgreSQL database.
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
import { RelatorioGuardadorFinancialMovementRepository } from './relatorio-guardador-financial-movement.repository';
import { RelatorioNovoRemessaFinancialMovementService } from './relatorio-novo-remessa-financial-movement.service';

// The service imports the PDF exporter, which this spec never uses; the virtual mock keeps the
// suite loadable where pdfkit is not installed.
jest.mock('pdfkit', () => jest.fn(), { virtual: true });

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

const BASE_ID = 995000000;
const USER_ID = BASE_ID + 1;
const PARENT_ID = BASE_ID + 10;
const CHILD_ID = BASE_ID + 11;
const PARENT_HISTORY_ID = BASE_ID + 20;
const CHILD_HISTORY_ID = BASE_ID + 21;
const CHILD_DETAIL_ID = BASE_ID + 30;
const CHILD_ORDER_ID = BASE_ID + 40;

suite('RelatorioNovoRemessaFinancialMovementService (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let service: RelatorioNovoRemessaFinancialMovementService;

  beforeAll(async () => {
    (global as any).__localTzOffset = 0;
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
    service = new RelatorioNovoRemessaFinancialMovementService(dataSource, new RelatorioGuardadorFinancialMovementRepository(dataSource));
  }, 60000);

  beforeEach(async () => {
    await cleanFixtures();
    await seedPaidPendingFamily();
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

    await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [BASE_ID + 30, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, [BASE_ID + 20, BASE_ID + 29]);
    await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, [BASE_ID + 40, BASE_ID + 99]);
    await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, [BASE_ID + 10, BASE_ID + 19]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [BASE_ID + 10, BASE_ID + 19]);
    await dataSource.query(`DELETE FROM public."user" WHERE id = $1`, [USER_ID]);
  }

  // A paid pending child (status 5, with its own detalhe_a) under a parent paid on 2099-02-05.
  async function seedPaidPendingFamily(): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', 'PERMISSIONARIO TESTE', 1, '99999999501',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [USER_ID, `permissionario-${USER_ID}@example.test`],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES
        ($1, DATE '2099-02-05', 100, NULL, now(), now()),
        ($2, DATE '2099-01-15', 100, $1, now(), now())`,
      [PARENT_ID, CHILD_ID],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2099-01-10', 100, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
      [CHILD_ORDER_ID, USER_ID, CHILD_ID],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa"
      ) VALUES
        ($1, $3, DATE '2099-02-05', '104', '0001', '99990002', '1', 5),
        ($2, $4, DATE '2099-01-15', '104', '0001', '99990002', '1', 5)`,
      [PARENT_HISTORY_ID, CHILD_HISTORY_ID, PARENT_ID, CHILD_ID],
    );

    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, 995001, DATE '2099-01-15', 100, 100, 995001, now(), now())`,
      [CHILD_DETAIL_ID, CHILD_HISTORY_ID],
    );
  }

  it('shows the paid pending child with its own line value and the parent payment date', async () => {
    const filter = {
      dataInicio: new Date('2099-02-05T00:00:00.000Z'),
      dataFim: new Date('2099-02-05T00:00:00.000Z'),
      pendenciaPaga: true,
      page: 1,
      pageSize: 50,
    };

    const [page, summary] = await Promise.all([service.findFinancialMovementPage(filter), service.findFinancialMovementSummary(filter)]);

    expect(page.data).toEqual([
      expect.objectContaining({
        dataReferencia: '15/01/2099',
        dataPagamento: '05/02/2099',
        valor: '100.00',
        status: 'Pendencia Paga',
      }),
    ]);
    expect(summary.count).toBe(1);
    expect(summary.valorPendenciaPaga).toBe(100);
  });

  // PASSO 0 children: paid pending orders never sent in a file of their own, so their history
  // rows (status 5) have no detalhe_a at all. In production each one has 1 to 6 ordem_pagamento
  // rows and its valorTotal is their sum (real case: 08/10/2026, 7 children, R$ 14.614,50).
  async function seedPasso0Family(): Promise<void> {
    const parent = BASE_ID + 12;
    const paidOne = BASE_ID + 13;
    const paidTwo = BASE_ID + 14;
    const unpaid = BASE_ID + 15;
    const am = BASE_ID + 16;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES
        ($1, DATE '2099-05-10', 266.20, NULL, now(), now()),
        ($2, DATE '2099-05-01', 54.60, $1, now(), now()),
        ($3, DATE '2099-05-01', 179.20, $1, now(), now()),
        ($4, DATE '2099-05-01', 22.40, $1, now(), now()),
        ($5, DATE '2099-05-01', 10.00, $1, now(), now())`,
      [parent, paidOne, paidTwo, unpaid, am],
    );

    // paidOne has three ordem_pagamento rows that add up to its valorTotal.
    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES
        ($1, DATE '2099-04-28', 20.00, now(), $7, 'CONSORCIO TESTE', $8, now(), now()),
        ($2, DATE '2099-04-29', 20.00, now(), $7, 'CONSORCIO TESTE', $8, now(), now()),
        ($3, DATE '2099-04-30', 14.60, now(), $7, 'CONSORCIO TESTE', $8, now(), now()),
        ($4, DATE '2099-04-30', 179.20, now(), $7, 'CONSORCIO TESTE', $9, now(), now()),
        ($5, DATE '2099-04-30', 22.40, now(), $7, 'CONSORCIO TESTE', $10, now(), now()),
        ($6, DATE '2099-04-30', 10.00, now(), $7, 'CONSORCIO TESTE', $11, now(), now())`,
      [BASE_ID + 41, BASE_ID + 42, BASE_ID + 43, BASE_ID + 44, BASE_ID + 45, BASE_ID + 46, USER_ID, paidOne, paidTwo, unpaid, am],
    );

    // paidTwo has two history rows (both status 5); unpaid is still status 1; am is paid but AM.
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES
        ($1, $7, DATE '2099-05-10', '104', '0001', '99990002', '1', 5, '00'),
        ($2, $8, DATE '2099-05-02', '104', '0001', '99990002', '1', 5, NULL),
        ($3, $9, DATE '2099-05-03', '104', '0001', '99990002', '1', 5, NULL),
        ($4, $9, DATE '2099-05-03', '104', '0001', '99990002', '1', 5, NULL),
        ($5, $10, DATE '2099-05-03', '104', '0001', '99990002', '1', 1, NULL),
        ($6, $11, DATE '2099-05-03', '104', '0001', '99990002', '1', 5, 'AM')`,
      [BASE_ID + 22, BASE_ID + 23, BASE_ID + 24, BASE_ID + 25, BASE_ID + 26, BASE_ID + 27, parent, paidOne, paidTwo, unpaid, am],
    );
  }

  it('includes paid children without any detalhe_a (PASSO 0) once each, with the order value and the parent payment date', async () => {
    await seedPasso0Family();

    const filter = {
      dataInicio: new Date('2099-05-10T00:00:00.000Z'),
      dataFim: new Date('2099-05-10T00:00:00.000Z'),
      pendenciaPaga: true,
      page: 1,
      pageSize: 50,
    };

    const [page, summary] = await Promise.all([service.findFinancialMovementPage(filter), service.findFinancialMovementSummary(filter)]);

    // One row per child (not per ordem_pagamento); the unpaid child and the AM child stay out.
    expect(page.data?.map((row) => [row.dataReferencia, row.valor, row.dataPagamento, row.status])).toEqual([
      ['02/05/2099', '54.60', '10/05/2099', 'Pendencia Paga'],
      ['03/05/2099', '179.20', '10/05/2099', 'Pendencia Paga'],
    ]);
    expect(summary.count).toBe(2);
    expect(summary.valorPendenciaPaga).toBeCloseTo(233.8, 2);
  });

  // Real case: 08/06/2026, child OPA 294935 (valorTotal 1.920,00) kept the detalhe_a lines of two
  // old attempts (1.920,00 and 4.497,60). The report summed both, R$ 4.497,60 above the extrato.
  async function seedChildWithOldAttempts(): Promise<{ parent: number }> {
    const parent = BASE_ID + 17;
    const child = BASE_ID + 18;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES
        ($1, DATE '2099-06-08', 19.20, NULL, now(), now()),
        ($2, DATE '2099-03-06', 19.20, $1, now(), now())`,
      [parent, child],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2099-03-01', 19.20, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
      [BASE_ID + 47, USER_ID, child],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES
        ($1, $3, DATE '2099-03-07', '104', '0001', '99990002', '1', 5, '00'),
        ($2, $3, DATE '2099-05-07', '104', '0001', '99990002', '1', 5, '00')`,
      [BASE_ID + 28, BASE_ID + 29, child],
    );

    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES
        ($1, $3, 995002, DATE '2099-03-06', 19.20, 19.20, 995002, now(), now()),
        ($2, $4, 995003, DATE '2099-05-07', 44.97, 44.97, 995003, now(), now())`,
      [BASE_ID + 31, BASE_ID + 32, BASE_ID + 28, BASE_ID + 29],
    );

    return { parent };
  }

  it('counts a child with several old attempt lines once, at its own value', async () => {
    await seedChildWithOldAttempts();

    const filter = {
      dataInicio: new Date('2099-06-08T00:00:00.000Z'),
      dataFim: new Date('2099-06-08T00:00:00.000Z'),
      pendenciaPaga: true,
      page: 1,
      pageSize: 50,
    };

    const [page, summary] = await Promise.all([service.findFinancialMovementPage(filter), service.findFinancialMovementSummary(filter)]);

    expect(page.data?.map((row) => [row.dataReferencia, row.valor, row.dataPagamento, row.status])).toEqual([
      ['06/03/2099', '19.20', '08/06/2099', 'Pendencia Paga'],
    ]);
    expect(summary.count).toBe(1);
    expect(summary.valorPendenciaPaga).toBeCloseTo(19.2, 2);

    // The day of the other attempt is not the payment day: the child must not show up there.
    const otherDay = await service.findFinancialMovementPage({
      ...filter,
      dataInicio: new Date('2099-05-07T00:00:00.000Z'),
      dataFim: new Date('2099-05-07T00:00:00.000Z'),
    });
    expect(otherDay.data).toEqual([]);
  });

  // Edge cases around the PASSO 0 children: every other filter must treat them like any other
  // paid-pending row, and the date bounds must be exact.
  const passo0Day = (extra: Record<string, unknown> = {}) => ({
    dataInicio: new Date('2099-05-10T00:00:00.000Z'),
    dataFim: new Date('2099-05-10T00:00:00.000Z'),
    pendenciaPaga: true,
    page: 1,
    pageSize: 50,
    ...extra,
  });
  const valores = (page: { data?: Array<{ valor: string }> }) => page.data?.map((row) => row.valor);

  it('applies the valor range to PASSO 0 children', async () => {
    await seedPasso0Family();

    expect(valores(await service.findFinancialMovementPage(passo0Day({ valorMin: 100 })))).toEqual(['179.20']);
    expect(valores(await service.findFinancialMovementPage(passo0Day({ valorMax: 100 })))).toEqual(['54.60']);
    expect(valores(await service.findFinancialMovementPage(passo0Day({ valorMin: 60, valorMax: 100 })))).toEqual([]);
  });

  it('applies the consorcio filter to PASSO 0 children', async () => {
    await seedPasso0Family();

    expect(valores(await service.findFinancialMovementPage(passo0Day({ consorcioNome: ['CONSORCIO TESTE'] })))).toEqual(['54.60', '179.20']);
    expect(valores(await service.findFinancialMovementPage(passo0Day({ consorcioNome: ['OUTRO CONSORCIO'] })))).toEqual([]);
  });

  it('keeps PASSO 0 children out when paid-pending is not selected', async () => {
    await seedPasso0Family();

    const page = await service.findFinancialMovementPage(passo0Day({ pendenciaPaga: false, pago: true }));

    expect(page.data?.filter((row) => row.status === 'Pendencia Paga')).toEqual([]);
  });

  it('matches the parent payment date exactly, one day before and after included', async () => {
    await seedPasso0Family();
    const day = (iso: string, end = iso) => passo0Day({ dataInicio: new Date(`${iso}T00:00:00.000Z`), dataFim: new Date(`${end}T00:00:00.000Z`) });

    expect(valores(await service.findFinancialMovementPage(day('2099-05-09')))).toEqual([]);
    expect(valores(await service.findFinancialMovementPage(day('2099-05-11')))).toEqual([]);
    expect(valores(await service.findFinancialMovementPage(day('2099-05-09', '2099-05-11')))).toEqual(['54.60', '179.20']);
  });

  it('walks PASSO 0 children across pages with the keyset cursor without losing or repeating one', async () => {
    await seedPasso0Family();

    const first = await service.findFinancialMovementPage(passo0Day({ pageSize: 1 }));
    const cursor = first.nextCursor as Record<string, string>;
    const second = await service.findFinancialMovementPage(
      passo0Day({
        pageSize: 1,
        cursorDataReferencia: cursor.dataReferencia,
        cursorNome: cursor.nomes,
        cursorStatus: cursor.status,
        cursorCpfCnpj: cursor.cpfCnpj,
        cursorNomeConsorcio: cursor.nomeConsorcio,
        cursorCodBanco: cursor.codBanco,
        cursorDataPagamento: cursor.dataPagamento,
        cursorEmail: cursor.email,
      }),
    );

    expect([...(valores(first) ?? []), ...(valores(second) ?? [])]).toEqual(['54.60', '179.20']);
  });

  it('streams the same PASSO 0 rows the page shows (export path)', async () => {
    await seedPasso0Family();

    const streamed: string[] = [];
    await service.streamFinancialMovementRows(passo0Day(), (row) => {
      streamed.push(row.valor);
    });

    expect(streamed).toEqual(['54.60', '179.20']);
  });

  it('ignores a paid child that has neither a detalhe_a nor an ordem_pagamento', async () => {
    await seedPasso0Family();
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2099-05-01', 0, $2, now(), now())`,
      [BASE_ID + 19, BASE_ID + 12],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES ($1, $2, DATE '2099-05-03', '104', '0001', '99990002', '1', 5, NULL)`,
      [BASE_ID + 28, BASE_ID + 19],
    );

    const page = await service.findFinancialMovementPage(passo0Day());

    expect(valores(page)).toEqual(['54.60', '179.20']);
    expect(page.count).toBe(2);
  });

  // Two old lines with exactly the child's valorTotal: the most recent line is kept, so the
  // result is the same on every run.
  it('keeps the most recent line when two old lines match the child valorTotal', async () => {
    await seedChildWithOldAttempts();
    await dataSource.query(`UPDATE detalhe_a SET "valorLancamento" = 19.20, "valorRealEfetivado" = 19.20 WHERE id = $1`, [BASE_ID + 32]);

    const page = await service.findFinancialMovementPage({
      dataInicio: new Date('2099-06-08T00:00:00.000Z'),
      dataFim: new Date('2099-06-08T00:00:00.000Z'),
      pendenciaPaga: true,
      page: 1,
      pageSize: 50,
    });

    expect(page.data?.map((row) => [row.dataReferencia, row.valor])).toEqual([['07/05/2099', '19.20']]);
  });

  it('applies the desativados filter to both paid-pending queries', async () => {
    await seedPasso0Family();

    // The fixture user is not blocked, so no row of either query may come back.
    const page = await service.findFinancialMovementPage({
      dataInicio: new Date('2099-05-10T00:00:00.000Z'),
      dataFim: new Date('2099-05-10T00:00:00.000Z'),
      pendenciaPaga: true,
      desativados: true,
      page: 1,
      pageSize: 50,
    });

    expect(page.data).toEqual([]);
  });
});
