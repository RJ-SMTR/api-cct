/**
 * Guardador financial movement coverage against a disposable PostgreSQL database.
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

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

const BASE_ID = 994000000;
const USER_ID = BASE_ID + 1;
const CHILD_ONE_ID = BASE_ID + 10;
const CHILD_TWO_ID = BASE_ID + 11;
const PARENT_ID = BASE_ID + 12;
const CHILD_ONE_HISTORY_ID = BASE_ID + 20;
const CHILD_TWO_HISTORY_ID = BASE_ID + 21;
const PARENT_HISTORY_ID = BASE_ID + 22;
const CHILD_ONE_DETAIL_ID = BASE_ID + 30;
const CHILD_TWO_DETAIL_ID = BASE_ID + 31;
const PARENT_DETAIL_ID = BASE_ID + 32;
const CHILD_ONE_ORDER_ID = BASE_ID + 40;
const CHILD_TWO_ORDER_ID = BASE_ID + 41;
const PAID_ORDER_ID = BASE_ID + 42;
const PAID_OPA_ID = BASE_ID + 13;
const PAID_HISTORY_ID = BASE_ID + 23;
const PAID_DETAIL_ID = BASE_ID + 33;

suite('RelatorioGuardadorFinancialMovementRepository (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: RelatorioGuardadorFinancialMovementRepository;

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
    repository = new RelatorioGuardadorFinancialMovementRepository(dataSource);
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

    await dataSource.query(`DELETE FROM detalhe_a WHERE id IN ($1, $2, $3, $4)`, [CHILD_ONE_DETAIL_ID, CHILD_TWO_DETAIL_ID, PARENT_DETAIL_ID, PAID_DETAIL_ID]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id IN ($1, $2, $3, $4)`, [CHILD_ONE_HISTORY_ID, CHILD_TWO_HISTORY_ID, PARENT_HISTORY_ID, PAID_HISTORY_ID]);
    await dataSource.query(`DELETE FROM ordem_pagamento_guardador WHERE id IN ($1, $2, $3)`, [CHILD_ONE_ORDER_ID, CHILD_TWO_ORDER_ID, PAID_ORDER_ID]);
    await dataSource.query(
      `UPDATE ordem_pagamento_agrupado
       SET "ordemPagamentoAgrupadoId" = NULL
       WHERE id IN ($1, $2)`,
      [CHILD_ONE_ID, CHILD_TWO_ID],
    );
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id IN ($1, $2, $3, $4)`, [CHILD_ONE_ID, CHILD_TWO_ID, PARENT_ID, PAID_OPA_ID]);
    await dataSource.query(`DELETE FROM public."user" WHERE id = $1`, [USER_ID]);
  }

  async function seedPaidPendingFamily(): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "permitCode", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', 'GUARDADOR PENDENCIA PAGA', 6, 'TEST-994', '99999999401',
        104, '0001', '99990001', '1', false, now(), now()
      )`,
      [USER_ID, `guardador-${USER_ID}@example.test`],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES
        ($1, DATE '2099-01-15', 100, $3, now(), now()),
        ($2, DATE '2099-01-25', 250, $3, now(), now()),
        ($3, DATE '2099-02-05', 350, NULL, now(), now())`,
      [CHILD_ONE_ID, CHILD_TWO_ID, PARENT_ID],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_guardador (
        id, "userId", "ordemPagamentoAgrupadoId", "dataOrdem", "dataInclusao",
        "tipoOrdemPagamento", "qtdVerificacaoTotal", "qtdVerificacaoValida",
        "qtdVerificacaoInvalida", "valorRepasseGuardador", "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES
        ($1, $3, $4, DATE '2099-01-10', DATE '2099-01-10', 'pendente', 0, 0, 0, 100, now(), now()),
        ($2, $3, $5, DATE '2099-01-20', DATE '2099-01-20', 'pendente', 0, 0, 0, 250, now(), now())`,
      [CHILD_ONE_ORDER_ID, CHILD_TWO_ORDER_ID, USER_ID, CHILD_ONE_ID, CHILD_TWO_ID],
    );

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa"
      ) VALUES
        ($1, $4, DATE '2099-01-15', '104', '0001', '99990001', '1', 5),
        ($2, $5, DATE '2099-01-25', '104', '0001', '99990001', '1', 5),
        ($3, $6, DATE '2099-02-05', '104', '0001', '99990001', '1', 5)`,
      [CHILD_ONE_HISTORY_ID, CHILD_TWO_HISTORY_ID, PARENT_HISTORY_ID, CHILD_ONE_ID, CHILD_TWO_ID, PARENT_ID],
    );

    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES
        ($1, $4, 994001, DATE '2099-01-15', 100, 100, 1, now(), now()),
        ($2, $5, 994002, DATE '2099-01-25', 250, 250, 2, now(), now()),
        ($3, $6, 994003, DATE '2099-02-05', 350, 350, 3, now(), now())`,
      [CHILD_ONE_DETAIL_ID, CHILD_TWO_DETAIL_ID, PARENT_DETAIL_ID, CHILD_ONE_HISTORY_ID, CHILD_TWO_HISTORY_ID, PARENT_HISTORY_ID],
    );
  }

  async function seedRegularPaidOrder(): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2099-02-05', 50, NULL, now(), now())`,
      [PAID_OPA_ID],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_guardador (
        id, "userId", "ordemPagamentoAgrupadoId", "dataOrdem", "dataInclusao",
        "tipoOrdemPagamento", "qtdVerificacaoTotal", "qtdVerificacaoValida",
        "qtdVerificacaoInvalida", "valorRepasseGuardador", "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES
        ($1, $2, $3, DATE '2099-02-05', DATE '2099-02-05', 'normal', 0, 0, 0, 50, now(), now())`,
      [PAID_ORDER_ID, USER_ID, PAID_OPA_ID],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa",
        "motivoStatusRemessa"
      ) VALUES ($1, $2, DATE '2099-02-05', '104', '0001', '99990001', '1', 3, '00')`,
      [PAID_HISTORY_ID, PAID_OPA_ID],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES
        ($1, $2, 994004, DATE '2099-02-05', 50, 50, 4, now(), now())`,
      [PAID_DETAIL_ID, PAID_HISTORY_ID],
    );
  }

  it('shows one row per child with child values and the parent effective payment date', async () => {
    const filter = {
      dataInicio: new Date('2099-02-05T00:00:00.000Z'),
      dataFim: new Date('2099-02-05T00:00:00.000Z'),
      pendenciaPaga: true,
      page: 1,
      pageSize: 50,
    };

    const [page, summary] = await Promise.all([repository.findFinancialMovementPage(filter), repository.findFinancialMovementSummary(filter)]);

    expect(page.data).toEqual([
      expect.objectContaining({
        dataReferencia: '15/01/2099',
        dataPagamento: '05/02/2099',
        valor: '100.00',
        status: 'Pendencia Paga',
      }),
      expect.objectContaining({
        dataReferencia: '25/01/2099',
        dataPagamento: '05/02/2099',
        valor: '250.00',
        status: 'Pendencia Paga',
      }),
    ]);
    expect(page.data).toHaveLength(2);
    expect(summary.count).toBe(2);
    expect(summary.valorPendenciaPaga).toBe(350);
    expect(summary.valorTotal).toBe(350);
  });

  it('keeps a multi-day paid-pending search oriented by the child attempt dates', async () => {
    const page = await repository.findFinancialMovementPage({
      dataInicio: new Date('2099-01-15T00:00:00.000Z'),
      dataFim: new Date('2099-01-25T00:00:00.000Z'),
      pendenciaPaga: true,
      page: 1,
      pageSize: 50,
    });

    expect(page.data).toEqual([
      expect.objectContaining({
        dataReferencia: '15/01/2099',
        dataPagamento: '05/02/2099',
        valor: '100.00',
      }),
      expect.objectContaining({
        dataReferencia: '25/01/2099',
        dataPagamento: '05/02/2099',
        valor: '250.00',
      }),
    ]);
  });

  it('combines the parent-date paid-pending branch with other selected statuses', async () => {
    await seedRegularPaidOrder();

    const filter = {
      dataInicio: new Date('2099-02-05T00:00:00.000Z'),
      dataFim: new Date('2099-02-05T00:00:00.000Z'),
      pendenciaPaga: true,
      pago: true,
      page: 1,
      pageSize: 50,
    };

    const [page, summary] = await Promise.all([repository.findFinancialMovementPage(filter), repository.findFinancialMovementSummary(filter)]);

    expect(page.data).toHaveLength(3);
    expect(page.data?.map((row) => [row.status, row.valor])).toEqual([
      ['Pendencia Paga', '100.00'],
      ['Pendencia Paga', '250.00'],
      ['Pago', '50.00'],
    ]);
    expect(summary.valorPendenciaPaga).toBe(350);
    expect(summary.valorPago).toBe(50);
    expect(summary.valorTotal).toBe(400);
  });
});
