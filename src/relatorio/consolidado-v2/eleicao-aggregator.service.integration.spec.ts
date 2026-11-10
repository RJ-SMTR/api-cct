/**
 * EleicaoAggregatorService coverage against a disposable PostgreSQL database.
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
import { BasePagamentoRepository } from '../movimentacao-financeira-v2/base/base-pagamento.repository';
import { RelatorioNovoRemessaConsolidadoRepository } from '../novo-remessa/relatorio-novo-remessa-consolidado.repository';
import { EleicaoAggregatorService } from './eleicao-aggregator.service';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

// Dedicated id range (coordinator instruction, 2026-11-10): other parallel tasks in this slice
// (T1/Pendência Paga-Pagamento, T3/STUC) reuse 994000000/995000000 for the shared
// consorcio-aggregator/vanzeiro-aggregator fixtures - this suite stays inside
// BASE_ID..BASE_ID+999 (993000000..993000999) and only ever cleans up that range, mirroring the
// "Eleição (T7)" describe block in base-pagamento.repository.integration.spec.ts.
const BASE_ID = 993000000;
const USER_PRIMARY_ID = BASE_ID + 1;
const USER_FALLBACK_ID = BASE_ID + 2;
const ELEICAO_CONSORCIO = 'ELEICAO CONSORCIO V2 TESTE';

suite('EleicaoAggregatorService (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let aggregator: EleicaoAggregatorService;
  let legacyConsolidadoRepository: RelatorioNovoRemessaConsolidadoRepository;

  beforeAll(async () => {
    // Same workaround as the other movimentacao-financeira-v2/consolidado-v2 integration specs
    // (CustomLogger.getTimestamp depends on a global set by test/global-setup.ts that isn't
    // reliably present in every worker process).
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
    aggregator = new EleicaoAggregatorService(new BasePagamentoRepository(dataSource));
    legacyConsolidadoRepository = new RelatorioNovoRemessaConsolidadoRepository(dataSource);

    // Same finding/workaround as base-pagamento.repository.integration.spec.ts ("Eleição (T7)"):
    // this local test database has no "ordem_pagamento_unico" table at all (it is only ever read
    // from, never INSERTed into, anywhere else in this codebase) - created idempotently here,
    // not a migration (this repo does not own that table's real schema).
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
  }, 60000);

  afterEach(async () => {
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

    await dataSource.query(`DELETE FROM ordem_pagamento_unico WHERE "idOrdemPagamento"::bigint BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM public."user" WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
  }

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
      [id, `eleicao-aggregator-v2-${id}@example.test`, fullName, cpfCnpj, permitCode],
    );
  }

  // opaId/historyId/detailId/opuId all derived from a single seedId, inside BASE_ID..+999.
  async function seedEleicaoOrder(params: {
    seedId: number;
    dataVencimento: string;
    valor: number;
    statusRemessa: number;
    idOperadora: string | null;
    operadoraCpfCnpj: string | null;
    consorcio?: string;
  }): Promise<void> {
    const opaId = BASE_ID + params.seedId * 10;
    const historyId = BASE_ID + params.seedId * 10 + 1;
    const detailId = BASE_ID + params.seedId * 10 + 2;
    const opuId = BASE_ID + params.seedId * 10 + 3;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $3, NULL, now(), now())`,
      [opaId, params.dataVencimento, params.valor],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES ($1, $2, $3::date, '104', '0001', '99990002', '1', $4, NULL)`,
      [historyId, opaId, params.dataVencimento, params.statusRemessa],
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
      [opuId, String(opaId), params.idOperadora, params.operadoraCpfCnpj, params.consorcio ?? ELEICAO_CONSORCIO, params.dataVencimento],
    );
  }

  it('todosConsorcios keeps only the fixed CONSORCIOS list and matches the legacy total', async () => {
    await seedEleicaoUser(USER_PRIMARY_ID, '99399999901', 'ELEC-V2-PC-1', 'ELEICAO AGG PRIMARY TESTE');
    await seedEleicaoOrder({ seedId: 70, dataVencimento: '2097-12-20', valor: 300, statusRemessa: 3, idOperadora: 'ELEC-V2-PC-1', operadoraCpfCnpj: '99399999901', consorcio: 'VLT' });
    await seedEleicaoOrder({ seedId: 71, dataVencimento: '2097-12-20', valor: 200, statusRemessa: 3, idOperadora: 'ELEC-V2-PC-1', operadoraCpfCnpj: '99399999901', consorcio: 'FORA DA LISTA' });
    const periodo = { dataInicio: new Date('2097-12-20T00:00:00.000Z'), dataFim: new Date('2097-12-20T00:00:00.000Z') };

    const [novo, antigo] = await Promise.all([
      aggregator.aggregateByConsorcio({ ...periodo, todosConsorcios: true }),
      legacyConsolidadoRepository.findConsolidado({ ...periodo, eleicao: true, todosConsorcios: true }),
    ]);

    expect(novo.data.map((linha) => linha.nomefavorecido)).toEqual(['VLT']);
    expect(novo.valor).toBe(300);
    expect(antigo.data.reduce((total, linha) => total + Number(linha.valor), 0)).toBe(novo.valor);
  });

  it('applies valorMin/valorMax to the favorecido total, not to each line', async () => {
    await seedEleicaoUser(USER_PRIMARY_ID, '99399999901', 'ELEC-V2-PC-1', 'ELEICAO AGG PRIMARY TESTE');
    for (const [seedId, dataVencimento] of [[60, '2097-12-10'], [61, '2097-12-11']] as const) {
      await seedEleicaoOrder({ seedId, dataVencimento, valor: 300, statusRemessa: 0, idOperadora: 'ELEC-V2-PC-1', operadoraCpfCnpj: '00000000000' });
    }
    const periodo = { dataInicio: new Date('2097-12-10T00:00:00.000Z'), dataFim: new Date('2097-12-11T00:00:00.000Z') };

    const [dentro, fora] = await Promise.all([aggregator.aggregateByFavorecido({ ...periodo, valorMin: 500 }), aggregator.aggregateByFavorecido({ ...periodo, valorMax: 500 })]);

    expect(dentro.valor).toBe(600);
    expect(fora.data).toEqual([]);
  });

  it('joins by permitCode/idOperadora and appears in both the favorecido and consorcio views with the correct value', async () => {
    await seedEleicaoUser(USER_PRIMARY_ID, '99399999901', 'ELEC-V2-PC-1', 'ELEICAO AGG PRIMARY TESTE');
    await seedEleicaoOrder({
      seedId: 10,
      dataVencimento: '2097-11-10',
      valor: 500,
      statusRemessa: 0,
      idOperadora: 'ELEC-V2-PC-1',
      operadoraCpfCnpj: '00000000000',
    });

    const filter = { dataInicio: new Date('2097-11-10T00:00:00.000Z'), dataFim: new Date('2097-11-10T00:00:00.000Z') };

    const [byFavorecido, byConsorcio] = await Promise.all([aggregator.aggregateByFavorecido(filter), aggregator.aggregateByConsorcio(filter)]);

    expect(byFavorecido.data).toHaveLength(1);
    expect(byFavorecido.data[0].nomefavorecido).toBe('ELEICAO AGG PRIMARY TESTE');
    expect(byFavorecido.data[0].valor).toBe(500);

    expect(byConsorcio.data).toHaveLength(1);
    expect(byConsorcio.data[0].nomefavorecido).toBe(ELEICAO_CONSORCIO);
    expect(byConsorcio.data[0].valor).toBe(500);
  });

  // Reproduz o caso real de nov/2024 (ADR 0019): ordem sem idOperadora preenchido.
  it('falls back to cpfCnpj when idOperadora has no match, appearing correctly in both views', async () => {
    await seedEleicaoUser(USER_FALLBACK_ID, '99399999902', null, 'ELEICAO AGG FALLBACK TESTE');
    await seedEleicaoOrder({
      seedId: 11,
      dataVencimento: '2097-11-11',
      valor: 400,
      statusRemessa: 1,
      idOperadora: null,
      operadoraCpfCnpj: '99399999902',
    });

    const filter = { dataInicio: new Date('2097-11-11T00:00:00.000Z'), dataFim: new Date('2097-11-11T00:00:00.000Z') };

    const [byFavorecido, byConsorcio] = await Promise.all([aggregator.aggregateByFavorecido(filter), aggregator.aggregateByConsorcio(filter)]);

    expect(byFavorecido.data).toHaveLength(1);
    expect(byFavorecido.data[0].nomefavorecido).toBe('ELEICAO AGG FALLBACK TESTE');
    expect(byFavorecido.data[0].valor).toBe(400);

    expect(byConsorcio.data).toHaveLength(1);
    expect(byConsorcio.data[0].valor).toBe(400);
  });

  // ADR 0004: Eleição's reduced status set has no own "Pendência Paga" bucket - statusRemessa=5
  // falls to the final ELSE (Rejeitado). "valor" (all statuses) must still include the row, but
  // "valorAPagar" (A Pagar only) must not - the same distinction VanzeiroAggregatorService/
  // ConsorcioAggregatorService (T3/T4) already make for the other sources.
  it('restricted status set: a statusRemessa=5 row counts in "valor" but never in "valorAPagar"', async () => {
    await seedEleicaoUser(USER_PRIMARY_ID, '99399999901', 'ELEC-V2-PC-1', 'ELEICAO AGG STATUS5 TESTE');
    await seedEleicaoOrder({
      seedId: 12,
      dataVencimento: '2097-11-12',
      valor: 150,
      statusRemessa: 5,
      idOperadora: 'ELEC-V2-PC-1',
      operadoraCpfCnpj: '99399999901',
    });

    const filter = { dataInicio: new Date('2097-11-12T00:00:00.000Z'), dataFim: new Date('2097-11-12T00:00:00.000Z') };

    const [byFavorecido, byConsorcio] = await Promise.all([aggregator.aggregateByFavorecido(filter), aggregator.aggregateByConsorcio(filter)]);

    expect(byFavorecido.valor).toBe(150);
    expect(byFavorecido.valorAPagar).toBe(0);
    expect(byConsorcio.valor).toBe(150);
    expect(byConsorcio.valorAPagar).toBe(0);
  });

  // Edge case: nem permitCode nem cpfCnpj resolvem - a ordem não deve aparecer em nenhuma das
  // duas visões, nem travar a agregação.
  it('does not appear in either view (and does not error) when neither idOperadora nor cpfCnpj match any user', async () => {
    await seedEleicaoOrder({
      seedId: 13,
      dataVencimento: '2097-11-13',
      valor: 999,
      statusRemessa: 0,
      idOperadora: 'NAO-EXISTE-V2',
      operadoraCpfCnpj: '00000000000',
    });

    const filter = { dataInicio: new Date('2097-11-13T00:00:00.000Z'), dataFim: new Date('2097-11-13T00:00:00.000Z') };

    const [byFavorecido, byConsorcio] = await Promise.all([aggregator.aggregateByFavorecido(filter), aggregator.aggregateByConsorcio(filter)]);

    expect(byFavorecido.data).toHaveLength(0);
    expect(byConsorcio.data).toHaveLength(0);
  });

  // Parity (Test-First Plan item 4): total por favorecido e por consórcio bate com
  // getQueryEleicaoVanzeiro/getQueryEleicaoConsorcio do legado, para o mesmo período, sem filtro
  // de favorecido/consórcio específico. Mesmo truque do T7 (userIds/consorcioNome exatos em vez
  // de todosVanzeiros/todosConsorcios no lado legado, para não acionar o MODAIS_FILTER/
  // CONSORCIOS allowlist pensado só para permitCodes/nomes reais - não se aplica aos valores
  // sintéticos deste fixture).
  //
  // Achado (reportar, não corrigir aqui - relatorio-novo-remessa-consolidado.repository.ts é
  // legado intocável): getQueryEleicaoVanzeiro/Consorcio (fromQueryEleicao) ligam o usuário SÓ
  // por "pu.cpfCnpj" = op."operadoraCpfCnpj" - nunca por permitCode/idOperadora. O join
  // permitCode-primário com fallback por cpfCnpj (ADR 0019) só foi aplicado em buildEleicaoQuery
  // (novo-remessa-query-builder.ts, usado por RelatorioNovoRemessaFinancialMovementService -
  // fonte do legacyPermissionarioService.findFinancialMovementSummary que o parity test do T7
  // usa), não neste repository. findEleicaoRows (T7, base desta task) replica o join corrigido
  // de buildEleicaoQuery, não o de getQueryEleicaoVanzeiro/Consorcio - por isso o fixture abaixo
  // usa operadoraCpfCnpj igual ao cpfCnpj do usuário mesmo quando idOperadora também bate (cenário
  // realista de produção, onde os dois campos concordam); um cpfCnpj deliberadamente divergente
  // do permitCode (como no teste "joins by permitCode" acima) faria getQueryEleicaoVanzeiro
  // descartar a linha (pu."cpfCnpj" não bate com nada -> nome IS NULL -> excluída pelo filtro
  // final), divergindo de findEleicaoRows/EleicaoAggregatorService por desenho, não por bug.
  it('matches the legacy getQueryEleicaoVanzeiro/getQueryEleicaoConsorcio totals (primary join + cpfCnpj fallback)', async () => {
    await seedEleicaoUser(USER_PRIMARY_ID, '99399999901', 'ELEC-V2-PC-1', 'ELEICAO AGG PRIMARY TESTE');
    await seedEleicaoUser(USER_FALLBACK_ID, '99399999902', null, 'ELEICAO AGG FALLBACK TESTE');
    await seedEleicaoOrder({ seedId: 10, dataVencimento: '2097-11-10', valor: 500, statusRemessa: 0, idOperadora: 'ELEC-V2-PC-1', operadoraCpfCnpj: '99399999901' });
    await seedEleicaoOrder({ seedId: 11, dataVencimento: '2097-11-11', valor: 400, statusRemessa: 1, idOperadora: null, operadoraCpfCnpj: '99399999902' });
    await seedEleicaoOrder({ seedId: 12, dataVencimento: '2097-11-12', valor: 150, statusRemessa: 5, idOperadora: 'ELEC-V2-PC-1', operadoraCpfCnpj: '99399999901' });

    const filter = { dataInicio: new Date('2097-11-01T00:00:00.000Z'), dataFim: new Date('2097-11-30T00:00:00.000Z') };

    const [byFavorecido, byConsorcio] = await Promise.all([aggregator.aggregateByFavorecido(filter), aggregator.aggregateByConsorcio(filter)]);

    const legacyFavorecidoFilter = {
      dataInicio: filter.dataInicio,
      dataFim: filter.dataFim,
      eleicao: true,
      userIds: [USER_PRIMARY_ID, USER_FALLBACK_ID],
    };
    const legacyConsorcioFilter = {
      dataInicio: filter.dataInicio,
      dataFim: filter.dataFim,
      eleicao: true,
      consorcioNome: [ELEICAO_CONSORCIO],
    };

    const [legacyFavorecido, legacyConsorcio] = await Promise.all([
      legacyConsolidadoRepository.findConsolidado(legacyFavorecidoFilter),
      legacyConsolidadoRepository.findConsolidado(legacyConsorcioFilter),
    ]);

    const legacyFavorecidoTotal = legacyFavorecido.data.reduce((total, row) => total + Number(row.valor), 0);
    const legacyConsorcioTotal = legacyConsorcio.data.reduce((total, row) => total + Number(row.valor), 0);
    const newFavorecidoTotal = byFavorecido.data.reduce((total, row) => total + row.valor, 0);
    const newConsorcioTotal = byConsorcio.data.reduce((total, row) => total + row.valor, 0);

    expect(newFavorecidoTotal).toBe(1050);
    expect(newFavorecidoTotal).toBe(legacyFavorecidoTotal);
    expect(newConsorcioTotal).toBe(1050);
    expect(newConsorcioTotal).toBe(legacyConsorcioTotal);
  });
});
