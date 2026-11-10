/**
 * StucGratuidadeAggregatorService coverage against a disposable PostgreSQL database.
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
import { StucGratuidadeRepository } from '../movimentacao-financeira-v2/stuc-gratuidade/stuc-gratuidade.repository';
import { RelatorioNovoRemessaConsolidadoRepository } from '../novo-remessa/relatorio-novo-remessa-consolidado.repository';
import { StucGratuidadeAggregatorService } from './stuc-gratuidade-aggregator.service';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

// Range dedicada a este arquivo (T3, fatia 2) - coordenado com o orquestrador para nao colidir
// com T1 (994000000/995000000) e T2 (993000000), que rodam specs de integracao contra o mesmo
// Postgres local em paralelo. Datas de calendario (2099-05, sexta-segunda/terca-quinta) tambem
// dedicadas a este arquivo, distintas das usadas em stuc-gratuidade.repository.integration.spec.ts
// (2026-10/2026-11) - esta agregacao nao filtra por userId (nao exposto pela rota v2, ver OQ-2),
// entao qualquer ordem de gratuidade de outro teste caindo na mesma janela de calendario
// contaminaria a contagem.
const BASE_ID = 992000000;
const USER_ID = BASE_ID + 1;
const FULL_NAME = 'PERMISSIONARIO STUC CONSOLIDADO V2 TESTE';

suite('StucGratuidadeAggregatorService (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let aggregator: StucGratuidadeAggregatorService;
  let legacyConsolidadoRepository: RelatorioNovoRemessaConsolidadoRepository;

  beforeAll(async () => {
    // Mesmo workaround de VanzeiroAggregatorService/ConsorcioAggregatorService: CustomLogger.
    // debug depende de global.__localTzOffset, nao garantido em todo worker quando varios
    // arquivos de spec rodam juntos.
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
    aggregator = new StucGratuidadeAggregatorService(new StucGratuidadeRepository(dataSource));
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

  // Limpeza escopada SOMENTE ao intervalo BASE_ID..BASE_ID+999 (coordenado com o orquestrador) -
  // nunca toca linhas de outro agente rodando em paralelo contra o mesmo banco.
  async function cleanFixtures(): Promise<void> {
    if (!dataSource?.isInitialized) return;
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
        $1, $2, 'email', $3, 1, '99999999801',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [USER_ID, `consolidado-v2-stuc-${USER_ID}@example.test`, FULL_NAME],
    );
  }

  async function insertOpa(id: number, dataPagamento: string, valorTotal: number, parentId: number | null = null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $3, $4, now(), now())`,
      [id, dataPagamento, valorTotal, parentId],
    );
  }

  async function insertHistorico(id: number, opaId: number, statusRemessa: number, motivo: string | null = null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES ($1, $2, now(), '104', '0001', '99990002', '1', $3, $4)`,
      [id, opaId, statusRemessa, motivo],
    );
  }

  async function insertDetalheA(id: number, historyId: number, dataVencimento: string, valorLancamento: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4::date, $5, $5, $3, now(), now())`,
      [id, historyId, id, dataVencimento, valorLancamento],
    );
  }

  async function insertOrdemGratuidade(id: number, userId: number, dataOrdem: string, valorGratuidade: number, opaGratuidadeId: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", valor, "valorGratuidade", "bqUpdatedAt", "userId", "nomeConsorcio",
        "ordemPagamentoAgrupadoGratuidadeId", "createdAt", "updatedAt"
      ) VALUES ($1, $2::date, $3, $3, now(), $4, 'CONSORCIO STUC V2 TESTE', $5, now(), now())`,
      [id, dataOrdem, valorGratuidade, userId, opaGratuidadeId],
    );
  }

  // Sexta-segunda (01-04/05/2099), pagamento terca 05/05/2099.
  const JANELA_4_DIAS = {
    sexta: '2099-05-01',
    sabado: '2099-05-02',
    domingo: '2099-05-03',
    segunda: '2099-05-04',
    pagamento: '2099-05-05',
  };
  // Terca-quinta seguinte (05-07/05/2099), pagamento sexta 08/05/2099.
  const JANELA_3_DIAS = {
    terca: '2099-05-05',
    quarta: '2099-05-06',
    quinta: '2099-05-07',
    pagamento: '2099-05-08',
  };

  async function seedJanela4Dias(opaId: number, valores: [number, number, number, number], statusRemessa = 3, motivo: string | null = '00'): Promise<void> {
    const historyId = opaId + 1;
    const detailId = opaId + 2;
    const total = valores.reduce((a, b) => a + b, 0);
    await insertOpa(opaId, JANELA_4_DIAS.pagamento, total);
    await insertHistorico(historyId, opaId, statusRemessa, motivo);
    await insertDetalheA(detailId, historyId, JANELA_4_DIAS.pagamento, total);
    const dias = [JANELA_4_DIAS.sexta, JANELA_4_DIAS.sabado, JANELA_4_DIAS.domingo, JANELA_4_DIAS.segunda];
    for (let i = 0; i < 4; i++) {
      await insertOrdemGratuidade(opaId + 3 + i, USER_ID, dias[i], valores[i], opaId);
    }
  }

  async function seedJanela3Dias(opaId: number, valores: [number, number, number]): Promise<void> {
    const historyId = opaId + 1;
    const detailId = opaId + 2;
    const total = valores.reduce((a, b) => a + b, 0);
    await insertOpa(opaId, JANELA_3_DIAS.pagamento, total);
    await insertHistorico(historyId, opaId, 3, '00');
    await insertDetalheA(detailId, historyId, JANELA_3_DIAS.pagamento, total);
    const dias = [JANELA_3_DIAS.terca, JANELA_3_DIAS.quarta, JANELA_3_DIAS.quinta];
    for (let i = 0; i < 3; i++) {
      await insertOrdemGratuidade(opaId + 3 + i, USER_ID, dias[i], valores[i], opaId);
    }
  }

  const filter = { dataInicio: new Date('2099-05-01T00:00:00.000Z'), dataFim: new Date('2099-05-31T00:00:00.000Z') };

  it('janela de 4 dias, todos preenchidos: resposta tem os 4 pares data/valor corretos', async () => {
    await seedUser();
    await seedJanela4Dias(BASE_ID + 10, [10, 20, 30, 40]);

    const result = await aggregator.aggregate(filter);

    expect(result.data).toHaveLength(1);
    const [row] = result.data;
    expect(row.nomefavorecido).toBe(FULL_NAME);
    expect(row.dataOrdemPagamento1).toBe('01/05/2099');
    expect(row.valorOrdemPagamento1).toBe(10);
    expect(row.dataOrdemPagamento2).toBe('02/05/2099');
    expect(row.valorOrdemPagamento2).toBe(20);
    expect(row.dataOrdemPagamento3).toBe('03/05/2099');
    expect(row.valorOrdemPagamento3).toBe(30);
    expect(row.dataOrdemPagamento4).toBe('04/05/2099');
    expect(row.valorOrdemPagamento4).toBe(40);
    expect(row.valor).toBe(100);
    expect(result.valor).toBe(100);
    expect(result.count).toBe(1);
  });

  it('janela de 3 dias: 4o par vem null/vazio (mesmo comportamento do pivot)', async () => {
    await seedUser();
    await seedJanela3Dias(BASE_ID + 20, [1, 2, 3]);

    const result = await aggregator.aggregate(filter);

    expect(result.data).toHaveLength(1);
    const [row] = result.data;
    expect(row.dataOrdemPagamento3).toBe('07/05/2099');
    expect(row.valorOrdemPagamento3).toBe(3);
    expect(row.dataOrdemPagamento4).toBeNull();
    expect(row.valorOrdemPagamento4).toBeNull();
    expect(row.valor).toBe(6);
  });

  it('ordens do mesmo lote em dias diferentes caem cada uma na sua coluna (achado 2026-10-26)', async () => {
    await seedUser();
    await seedJanela4Dias(BASE_ID + 40, [11, 22, 33, 44]);

    const result = await aggregator.aggregate(filter);

    expect(result.data).toHaveLength(1);
    const [row] = result.data;
    expect([row.dataOrdemPagamento1, row.dataOrdemPagamento2, row.dataOrdemPagamento3, row.dataOrdemPagamento4]).toEqual([
      '01/05/2099',
      '02/05/2099',
      '03/05/2099',
      '04/05/2099',
    ]);
    expect([row.valorOrdemPagamento1, row.valorOrdemPagamento2, row.valorOrdemPagamento3, row.valorOrdemPagamento4]).toEqual([11, 22, 33, 44]);
  });

  it('dia sem lancamento dentro da janela: data real aparece com valor 0 (nao "pula" o dia)', async () => {
    await seedUser();
    const opaId = BASE_ID + 50;
    const historyId = opaId + 1;
    const detailId = opaId + 2;
    await insertOpa(opaId, JANELA_4_DIAS.pagamento, 50);
    await insertHistorico(historyId, opaId, 3, '00');
    await insertDetalheA(detailId, historyId, JANELA_4_DIAS.pagamento, 50);
    // Sem ordem no sabado (posicao 2) - so sexta, domingo e segunda.
    await insertOrdemGratuidade(opaId + 3, USER_ID, JANELA_4_DIAS.sexta, 10, opaId);
    await insertOrdemGratuidade(opaId + 5, USER_ID, JANELA_4_DIAS.domingo, 15, opaId);
    await insertOrdemGratuidade(opaId + 6, USER_ID, JANELA_4_DIAS.segunda, 25, opaId);

    const result = await aggregator.aggregate(filter);

    expect(result.data).toHaveLength(1);
    const [row] = result.data;
    expect(row.dataOrdemPagamento2).toBe('02/05/2099');
    expect(row.valorOrdemPagamento2).toBe(0);
    expect(row.valor).toBe(50);
  });

  // AC-6 - caso de borda confirmado contra producao em 2026-11-06 (ver T3.md/comentario em
  // StucGratuidadeRepository.findDayRows): com stucGratuidade=true e pendenciaPaga=true isolado
  // marcado (nenhum outro status), o total devolvido e' o mesmo que com "Todos" os status.
  // Herdado de StucGratuidadeRepository.findRows (pendencia_paga nunca entra em
  // statusStuc/subErroStatus/condicaoRejeitado) - teste dedicado, nao inferido de outro teste.
  it('AC-6: pendenciaPaga isolado devolve o mesmo total que "Todos" os status (caso de borda de producao)', async () => {
    await seedUser();
    // Pendencia Paga (status 5) - unico lancamento no periodo, nenhum outro status presente.
    const opaPaiId = BASE_ID + 60;
    const opaFilhaId = BASE_ID + 61;
    await insertOpa(opaPaiId, JANELA_4_DIAS.pagamento, 777);
    await insertOpa(opaFilhaId, JANELA_4_DIAS.pagamento, 777, opaPaiId);
    await insertHistorico(opaFilhaId + 10, opaFilhaId, 5);
    await insertDetalheA(opaFilhaId + 11, opaFilhaId + 10, JANELA_4_DIAS.pagamento, 777);
    await insertOrdemGratuidade(opaFilhaId + 12, USER_ID, JANELA_4_DIAS.sexta, 777, opaFilhaId);

    const [pendenciaPagaIsolada, todos] = await Promise.all([
      aggregator.aggregate({ ...filter, statuses: [StatusPagamento.PENDENCIA_PAGA] }),
      aggregator.aggregate(filter),
    ]);

    expect(pendenciaPagaIsolada.data).toHaveLength(1);
    expect(todos.data).toHaveLength(1);
    expect(pendenciaPagaIsolada.valor).toBe(todos.valor);
    expect(pendenciaPagaIsolada.data[0].valor).toBe(todos.data[0].valor);
    expect(todos.data[0].valor).toBe(777);
  });

  describe('paridade com findConsolidadoStucGratuidade (legado)', () => {
    // temFiltroVanzeiros do legado exige userIds OU todosVanzeiros - sem nenhum dos dois, o
    // legado nao constroi NENHUMA das duas visoes de STUC (confirmado lendo findConsolidado:
    // queryStucGratuidadeVanzeiro/Consorcio so' entram com um desses filtros). userIds aqui e'
    // so' para acionar a mesma branch do legado, nao equivale a expor userIds por esta rota.
    function legacyFilter(overrides: Record<string, unknown> = {}) {
      return {
        dataInicio: filter.dataInicio,
        dataFim: filter.dataFim,
        stucGratuidade: true,
        userIds: [USER_ID],
        ...overrides,
      };
    }

    it('janela de 4 dias: mesmo total por favorecido que o legado', async () => {
      await seedUser();
      await seedJanela4Dias(BASE_ID + 300, [10, 20, 30, 40]);

      const [novo, legado] = await Promise.all([
        aggregator.aggregate(filter),
        legacyConsolidadoRepository.findConsolidado(legacyFilter() as any),
      ]);

      expect(novo.data).toHaveLength(1);
      expect(legado.data).toHaveLength(1);
      expect(novo.data[0].valor).toBe(legado.data[0].valor);
    });

    it('janela de 3 dias: mesmo total por favorecido que o legado', async () => {
      await seedUser();
      await seedJanela3Dias(BASE_ID + 310, [1, 2, 3]);

      const [novo, legado] = await Promise.all([
        aggregator.aggregate(filter),
        legacyConsolidadoRepository.findConsolidado(legacyFilter() as any),
      ]);

      expect(novo.data).toHaveLength(1);
      expect(legado.data).toHaveLength(1);
      expect(novo.data[0].valor).toBe(legado.data[0].valor);
    });

    it('dia sem lancamento dentro da janela: mesmo total que o legado', async () => {
      await seedUser();
      const opaId = BASE_ID + 320;
      const historyId = opaId + 1;
      const detailId = opaId + 2;
      await insertOpa(opaId, JANELA_4_DIAS.pagamento, 50);
      await insertHistorico(historyId, opaId, 3, '00');
      await insertDetalheA(detailId, historyId, JANELA_4_DIAS.pagamento, 50);
      await insertOrdemGratuidade(opaId + 3, USER_ID, JANELA_4_DIAS.sexta, 10, opaId);
      await insertOrdemGratuidade(opaId + 5, USER_ID, JANELA_4_DIAS.domingo, 15, opaId);
      await insertOrdemGratuidade(opaId + 6, USER_ID, JANELA_4_DIAS.segunda, 25, opaId);

      const [novo, legado] = await Promise.all([
        aggregator.aggregate(filter),
        legacyConsolidadoRepository.findConsolidado(legacyFilter() as any),
      ]);

      expect(novo.data).toHaveLength(1);
      expect(legado.data).toHaveLength(1);
      expect(novo.data[0].valor).toBe(legado.data[0].valor);
    });

    it('ordens do mesmo lote em dias diferentes: mesmo total que o legado (achado 2026-10-26)', async () => {
      await seedUser();
      await seedJanela4Dias(BASE_ID + 330, [11, 22, 33, 44]);

      const [novo, legado] = await Promise.all([
        aggregator.aggregate(filter),
        legacyConsolidadoRepository.findConsolidado(legacyFilter() as any),
      ]);

      expect(novo.data).toHaveLength(1);
      expect(legado.data).toHaveLength(1);
      expect(novo.data[0].valor).toBe(legado.data[0].valor);
    });
  });
});
