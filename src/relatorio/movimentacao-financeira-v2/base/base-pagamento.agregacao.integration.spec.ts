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
import { BasePagamentoFilter, BasePagamentoRepository, BasePagamentoRow, Perfil } from './base-pagamento.repository';
import { VanzeiroAggregatorService } from '../../consolidado-v2/vanzeiro-aggregator.service';
import { ConsorcioAggregatorService } from '../../consolidado-v2/consorcio-aggregator.service';
import { ConsolidadoCombinadoService } from '../../consolidado-v2/consolidado-combinado.service';

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

// Reference: the in-memory Consolidado-by-favorecido algorithm that T5 replaces (VanzeiroAggregatorService before
// ADR 0023), kept here verbatim so the database version is compared against it.
function agregarPorFavorecidoEmMemoria(allRows: BasePagamentoRow[], valorMin?: number, valorMax?: number, somenteIndividuais?: boolean) {
  const comFavorecido = allRows.filter((row) => row.nomes !== null);
  const rows = somenteIndividuais ? comFavorecido.filter((row) => row.cpfCnpj && row.cpfCnpj.length <= 11) : comFavorecido;
  const valorSemFavorecido = allRows.filter((row) => row.nomes === null).reduce((total, row) => total + Number(row.valor), 0);
  const totais = new Map<string, { nome: string; cpfCnpj: string | null; valor: number }>();
  for (const row of rows) {
    const existente = totais.get(row.nomes);
    if (existente) existente.valor += Number(row.valor);
    else totais.set(row.nomes, { nome: row.nomes, cpfCnpj: row.cpfCnpj, valor: Number(row.valor) });
  }
  const filtrados = [...totais.values()].filter((f) => !(valorMin !== undefined && f.valor < valorMin) && !(valorMax !== undefined && f.valor > valorMax));
  const nomes = new Set(filtrados.map((f) => f.nome));
  const valorAPagar = rows.filter((row) => row.status === StatusPagamento.A_PAGAR && nomes.has(row.nomes)).reduce((t, row) => t + Number(row.valor), 0);
  const data = filtrados
    .map((f) => ({ nomefavorecido: f.nome, cpfCnpj: f.cpfCnpj, valor: f.valor }))
    .sort((a, b) => a.nomefavorecido.localeCompare(b.nomefavorecido, 'pt-BR'));
  return { count: data.length, valor: data.reduce((t, f) => t + f.valor, 0), valorAPagar, valorSemFavorecido, data };
}

// Reference: the in-memory Consolidado-by-consorcio algorithm that T6 replaces (ConsorcioAggregatorService before
// ADR 0023), kept here verbatim.
function agregarPorConsorcioEmMemoria(todasAsLinhas: BasePagamentoRow[], valorMin?: number, valorMax?: number) {
  const rows = todasAsLinhas.filter((row) => row.nomes !== null);
  const totais = new Map<string, number>();
  for (const row of rows) {
    if (row.nomeConsorcio === null) continue;
    totais.set(row.nomeConsorcio, (totais.get(row.nomeConsorcio) ?? 0) + Number(row.valor));
  }
  const filtrados = [...totais.entries()].filter(([, valor]) => !(valorMin !== undefined && valor < valorMin) && !(valorMax !== undefined && valor > valorMax));
  const nomes = new Set(filtrados.map(([nome]) => nome));
  const valorAPagar = rows
    .filter((row) => row.status === StatusPagamento.A_PAGAR && row.nomeConsorcio !== null && nomes.has(row.nomeConsorcio))
    .reduce((t, row) => t + Number(row.valor), 0);
  const data = filtrados.map(([nome, valor]) => ({ nomefavorecido: nome, valor })).sort((a, b) => a.nomefavorecido.localeCompare(b.nomefavorecido, 'pt-BR'));
  const valorSemFavorecido = todasAsLinhas.filter((row) => row.nomes === null).reduce((t, row) => t + Number(row.valor), 0);
  return { count: data.length, valor: data.reduce((t, c) => t + c.valor, 0), valorAPagar, valorSemFavorecido, data };
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

  describe('VanzeiroAggregatorService no banco (T5)', () => {
    const casosFavorecido: [string, Perfil, Partial<BasePagamentoFilter>, boolean][] = [
      ['permissionario, todos os favorecidos (so pessoas fisicas)', 'permissionario', {}, true],
      ['permissionario, sem recorte de pessoa fisica', 'permissionario', {}, false],
      ['permissionario, todos os consorcios por favorecido', 'permissionario', { todosConsorcios: true }, false],
      ['permissionario, favorecido especifico', 'permissionario', { userIds: [U_STPC_A] }, false],
      ['permissionario, so A Pagar', 'permissionario', { statuses: [StatusPagamento.A_PAGAR] }, false],
      ['permissionario, valor minimo sobre o total do favorecido', 'permissionario', { valorMin: 300 }, false],
      ['permissionario, valor maximo sobre o total do favorecido', 'permissionario', { todosConsorcios: true, valorMax: 500 }, false],
      ['guardador, sem filtro', 'guardador', {}, false],
      ['guardador, valor maximo', 'guardador', { valorMax: 100 }, false],
    ];

    it.each(casosFavorecido)('%s', async (_nome, perfil, extra, somenteIndividuais) => {
      const aggregator = new VanzeiroAggregatorService(repository);
      const { valorMin, valorMax, ...semValor } = { ...PERIODO, ...extra } as BasePagamentoFilter;

      const [linhas, noBanco] = await Promise.all([
        repository.findGroupedRows(perfil, semValor),
        aggregator.aggregate({ ...PERIODO, ...extra } as BasePagamentoFilter, perfil, { somenteIndividuais }),
      ]);
      const emMemoria = agregarPorFavorecidoEmMemoria(linhas, valorMin, valorMax, somenteIndividuais);

      expect(noBanco.count).toBe(emMemoria.count);
      expect(noBanco.valor).toBeCloseTo(emMemoria.valor, 2);
      expect(noBanco.valorAPagar).toBeCloseTo(emMemoria.valorAPagar, 2);
      expect(noBanco.valorSemFavorecido).toBeCloseTo(emMemoria.valorSemFavorecido, 2);
      expect(noBanco.data.map((d) => [d.nomefavorecido, d.cpfCnpj, Number(d.valor.toFixed(2))])).toEqual(
        emMemoria.data.map((d) => [d.nomefavorecido, d.cpfCnpj, Number(d.valor.toFixed(2))]),
      );
    });

    it('does not load every row of the period (aggregates in the database)', async () => {
      const spy = jest.spyOn(repository, 'findGroupedRows');
      await new VanzeiroAggregatorService(repository).aggregate({ ...PERIODO }, 'permissionario');

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('ConsorcioAggregatorService no banco (T6)', () => {
    const casosConsorcio: [string, Partial<BasePagamentoFilter>, { consorcioNome?: string[]; todosConsorcios?: boolean }][] = [
      ['todos os consorcios', {}, { todosConsorcios: true }],
      ['consorcio especifico', {}, { consorcioNome: ['Intersul'] }],
      ['um modal', {}, { consorcioNome: ['STPL'] }],
      ['so Pago', { statuses: [StatusPagamento.PAGO] }, { todosConsorcios: true }],
      ['valor minimo sobre o total do consorcio', { valorMin: 1000 }, { todosConsorcios: true }],
      ['valor maximo sobre o total do consorcio', { valorMax: 700 }, { todosConsorcios: true }],
    ];

    it.each(casosConsorcio)('%s', async (_nome, extra, opcoes) => {
      const { valorMin, valorMax, ...semValor } = { ...PERIODO, ...extra } as BasePagamentoFilter;

      const [linhas, noBanco] = await Promise.all([
        repository.findGroupedRows('permissionario', { ...semValor, ...opcoes }),
        new ConsorcioAggregatorService(repository).aggregate({ ...PERIODO, ...extra } as BasePagamentoFilter, opcoes),
      ]);
      const emMemoria = agregarPorConsorcioEmMemoria(linhas, valorMin, valorMax);

      expect(noBanco.count).toBe(emMemoria.count);
      expect(noBanco.valor).toBeCloseTo(emMemoria.valor, 2);
      expect(noBanco.valorAPagar).toBeCloseTo(emMemoria.valorAPagar, 2);
      expect(noBanco.valorSemFavorecido).toBeCloseTo(emMemoria.valorSemFavorecido, 2);
      expect(noBanco.data.map((d) => [d.nomefavorecido, Number(d.valor.toFixed(2))])).toEqual(emMemoria.data.map((d) => [d.nomefavorecido, Number(d.valor.toFixed(2))]));
    });

    it('combined view (todos os favorecidos + todos os consorcios) keeps the total of the consorcio view', async () => {
      const combinado = new ConsolidadoCombinadoService(new ConsorcioAggregatorService(repository), new VanzeiroAggregatorService(repository));
      const linhas = await repository.findGroupedRows('permissionario', { ...PERIODO, todosConsorcios: true });

      const resultado = await combinado.aggregate({ ...PERIODO }, { todosVanzeiros: true, todosConsorcios: true });

      expect(resultado.valor).toBeCloseTo(agregarPorConsorcioEmMemoria(linhas).valor, 2);
    });

    it('does not load every row of the period (aggregates in the database)', async () => {
      const spy = jest.spyOn(repository, 'findGroupedRows');
      await new ConsorcioAggregatorService(repository).aggregate({ ...PERIODO }, { todosConsorcios: true });

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Consolidado de Guardador por status em uma consulta (T11)', () => {
    const STATUS = [StatusPagamento.PAGO, StatusPagamento.A_PAGAR, StatusPagamento.AGUARDANDO_PAGAMENTO, StatusPagamento.PENDENCIA_PAGA, StatusPagamento.ERRO_REJEITADO, StatusPagamento.ERRO_ESTORNO];

    it.each([
      ['guardador, todos os status', 'guardador' as Perfil, {}],
      ['guardador, todos os status com valor maximo', 'guardador' as Perfil, { valorMax: 100 }],
      ['permissionario, todos os status', 'permissionario' as Perfil, {}],
    ])('%s: one query gives the same blocks as one query per status', async (_nome, perfil, extra) => {
      const aggregator = new VanzeiroAggregatorService(repository);

      const umaConsulta = await aggregator.aggregatePorStatus({ ...PERIODO, ...extra, statuses: STATUS } as BasePagamentoFilter, perfil);
      const porStatus = await Promise.all(STATUS.map((status) => aggregator.aggregate({ ...PERIODO, ...extra, statuses: [status] } as BasePagamentoFilter, perfil)));

      expect(umaConsulta.map((bloco) => bloco.status)).toEqual(STATUS);
      umaConsulta.forEach((bloco, i) => {
        expect(bloco.count).toBe(porStatus[i].count);
        expect(bloco.valor).toBeCloseTo(porStatus[i].valor, 2);
        expect(bloco.data.map((d) => [d.nomefavorecido, Number(d.valor.toFixed(2))])).toEqual(porStatus[i].data.map((d) => [d.nomefavorecido, Number(d.valor.toFixed(2))]));
      });
    });
  });
});
