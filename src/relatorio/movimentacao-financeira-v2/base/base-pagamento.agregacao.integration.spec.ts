/**
 * ADR 0023: database-side aggregation must match the in-memory sums it replaces, to the cent.
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
import { buildSummaryFromRows } from '../export/financial-movement-v2-export.service';
import { BasePagamentoFilter, BasePagamentoRepository, Perfil } from './base-pagamento.repository';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

// Own id range (988xxxxxx), distinct from every other integration spec.
const BASE_ID = 988000000;
const U_STPC_A = BASE_ID + 1;
const U_STPL_B = BASE_ID + 2;
const U_STPC_A_HOMONIMO = BASE_ID + 3;
const U_INTERSUL = BASE_ID + 4;
const U_GUARDADOR = BASE_ID + 5;

const PERIODO = { dataInicio: new Date('2097-03-01T00:00:00.000Z'), dataFim: new Date('2097-03-31T00:00:00.000Z') };

function expectSameSummary(actual: Record<string, unknown>, expected: Record<string, unknown>): void {
  for (const key of Object.keys(expected)) {
    expect([key, Number(actual[key])]).toEqual([key, expect.closeTo(Number(expected[key]), 2)]);
  }
}

suite('BasePagamentoRepository database aggregation parity (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: BasePagamentoRepository;

  beforeAll(async () => {
    jest.spyOn(CustomLogger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(CustomLogger.prototype, 'error').mockImplementation(() => undefined);

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig, appConfig], envFilePath: ['.env'] }),
        TypeOrmModule.forRootAsync({
          useClass: TypeOrmConfigService,
          dataSourceFactory: async (options: DataSourceOptions) => new DataSource(options).initialize(),
        }),
      ],
    }).compile();

    dataSource = moduleRef.get(getDataSourceToken());
    repository = new BasePagamentoRepository(dataSource);

    await cleanFixtures();
    await seedFixtures();
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await cleanFixtures();
    }
    await moduleRef?.close();
  });

  async function cleanFixtures(): Promise<void> {
    const range = [BASE_ID, BASE_ID + 999];
    await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM ordem_pagamento_guardador WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM public."user" WHERE id BETWEEN $1 AND $2`, range);
  }

  async function seedUser(id: number, fullName: string, cpfCnpj: string, roleId = 1): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES ($1, $2, 'email', $3, $4, $5, 104, '0001', '99990002', '1', false, now(), now())`,
      [id, `agregacao-${id}@example.test`, fullName, roleId, cpfCnpj],
    );
  }

  // A Pagar never sent: one loose order, no grouping.
  async function seedNuncaEnviada(id: number, userId: number | null, consorcio: string, valor: number, dia: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, $2::date, $2::date, $3, now(), $4, $5, NULL, now(), now())`,
      [id, dia, valor, userId, consorcio],
    );
  }

  // Grouped and sent: grouping + one inner order + history (statusRemessa) + detalhe_a.
  async function seedAgrupada(base: number, userId: number, consorcio: string, valor: number, dia: string, statusRemessa: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $3, NULL, now(), now())`,
      [base, dia, valor],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, $2::date, $3, now(), $4, $5, $6, now(), now())`,
      [base + 1, dia, valor, userId, consorcio, base],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES ($1, $2, $3::date, '104', '0001', '99990002', '1', $4, $5)`,
      [base + 2, base, dia, statusRemessa, statusRemessa === 3 ? '00' : null],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $1, $3::date, $4, $4, $1, now(), now())`,
      [base + 3, base + 2, dia, valor],
    );
  }

  async function seedGuardadorNuncaEnviada(id: number, userId: number, valor: number, dia: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_guardador (
        id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId", "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
        "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida", "createdAt", "updatedAt"
      ) VALUES ($1, $2::date, $2::date, $3, $4, 'AUTOMATICA', NULL, 0, 0, 0, now(), now())`,
      [id, dia, valor, userId],
    );
  }

  async function seedFixtures(): Promise<void> {
    await dataSource.query(`INSERT INTO role (id, name) VALUES (6, 'agentes') ON CONFLICT (id) DO NOTHING`);
    await seedUser(U_STPC_A, 'AGREGACAO FAVORECIDO A', '98800000001');
    await seedUser(U_STPL_B, 'AGREGACAO FAVORECIDO B', '98800000002');
    await seedUser(U_STPC_A_HOMONIMO, 'AGREGACAO FAVORECIDO A', '98800000003');
    await seedUser(U_INTERSUL, 'AGREGACAO CONSORCIO INTERSUL', '98800000000104');
    await seedUser(U_GUARDADOR, 'AGREGACAO GUARDADOR', '98800000005', 6);

    // A Pagar never sent (one without favorecido).
    await seedNuncaEnviada(BASE_ID + 100, U_STPC_A, 'STPC', 100.1, '2097-03-05');
    await seedNuncaEnviada(BASE_ID + 101, U_STPL_B, 'STPL', 200.2, '2097-03-06');
    await seedNuncaEnviada(BASE_ID + 102, U_STPC_A_HOMONIMO, 'STPC', 50.05, '2097-03-07');
    await seedNuncaEnviada(BASE_ID + 103, U_INTERSUL, 'Intersul', 1000, '2097-03-08');
    await seedNuncaEnviada(BASE_ID + 104, null, 'STPC', 33.33, '2097-03-09');

    // Grouped and sent: Pago (3), Aguardando Pagamento (2), A Pagar sent (0).
    await seedAgrupada(BASE_ID + 200, U_STPC_A, 'STPC', 300.3, '2097-03-10', 3);
    await seedAgrupada(BASE_ID + 210, U_STPL_B, 'STPL', 400.4, '2097-03-11', 2);
    await seedAgrupada(BASE_ID + 220, U_INTERSUL, 'Intersul', 2000, '2097-03-12', 3);
    await seedAgrupada(BASE_ID + 230, U_STPL_B, 'STPL', 0.07, '2097-03-13', 0);

    // Guardador.
    await seedGuardadorNuncaEnviada(BASE_ID + 300, U_GUARDADOR, 654.32, '2097-03-14');
    await seedGuardadorNuncaEnviada(BASE_ID + 301, U_GUARDADOR, 11.11, '2097-03-15');
  }

  const casos: [string, Perfil, Partial<BasePagamentoFilter>][] = [
    ['permissionario, nenhum favorecido nem consorcio (so modais)', 'permissionario', {}],
    ['permissionario, favorecido especifico', 'permissionario', { userIds: [U_STPC_A] }],
    ['permissionario, todos os consorcios', 'permissionario', { todosConsorcios: true }],
    ['permissionario, consorcio especifico', 'permissionario', { consorcioNome: ['Intersul'] }],
    ['permissionario, so Pago', 'permissionario', { statuses: [StatusPagamento.PAGO] }],
    ['permissionario, A Pagar + Aguardando', 'permissionario', { statuses: [StatusPagamento.A_PAGAR, StatusPagamento.AGUARDANDO_PAGAMENTO] }],
    ['permissionario, valor minimo sobre o total', 'permissionario', { todosConsorcios: true, valorMin: 1500 }],
    ['permissionario, valor maximo sobre o total', 'permissionario', { valorMax: 500 }],
    ['guardador, sem filtro', 'guardador', {}],
    ['guardador, favorecido especifico', 'guardador', { userIds: [U_GUARDADOR] }],
  ];

  describe('findSummaryTotals (T3)', () => {
    it.each(casos)('%s', async (_nome, perfil, extra) => {
      const filter: BasePagamentoFilter = { ...PERIODO, ...extra };

      const [emMemoria, noBanco] = await Promise.all([
        repository.findGroupedRows(perfil, filter).then(buildSummaryFromRows),
        repository.findSummaryTotals(perfil, filter),
      ]);

      expect(emMemoria.count).toBeGreaterThan(0);
      expectSameSummary({ ...noBanco }, { ...emMemoria });
    });

    it('returns zeros for a period without rows', async () => {
      const filter: BasePagamentoFilter = { dataInicio: new Date('2097-05-01T00:00:00.000Z'), dataFim: new Date('2097-05-31T00:00:00.000Z') };

      const noBanco = await repository.findSummaryTotals('permissionario', filter);

      expectSameSummary({ ...noBanco }, { ...buildSummaryFromRows([]) });
    });
  });
});
