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
    await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id = $1`, [CHILD_ID]);
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
});
