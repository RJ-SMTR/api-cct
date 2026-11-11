/**
 * StucGratuidadeRepository coverage against a disposable PostgreSQL database.
 * Run with RUN_RETORNO_DB_TESTS=1 only against an isolated local test database.
 */
import { format } from 'date-fns';
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
import { StucGratuidadeRepository } from './stuc-gratuidade.repository';

jest.mock('pdfkit', () => jest.fn(), { virtual: true });

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

// Range dedicada a este arquivo (T8) - distinta das usadas por base-pagamento.repository.
// integration.spec.ts (996000000+) e por outras tasks paralelas rodando contra o mesmo
// Postgres local (T4/T6/T7). Coordenado com o orquestrador: 996040000..996040999 - todos os
// ids de fixture deste arquivo (opa/historico/detalhe_a/ordem) ficam dentro desse intervalo.
const BASE_ID = 996040000;
const USER_ID = BASE_ID + 1;

function formatDate(date: Date | null): string | null {
  return date ? format(date, 'dd/MM/yyyy') : null;
}

suite('StucGratuidadeRepository (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: StucGratuidadeRepository;
  let legacyService: RelatorioNovoRemessaFinancialMovementService;

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
    repository = new StucGratuidadeRepository(dataSource);
    const legacyGuardadorRepository = new RelatorioGuardadorFinancialMovementRepository(dataSource);
    legacyService = new RelatorioNovoRemessaFinancialMovementService(dataSource, legacyGuardadorRepository);
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
        $1, $2, 'email', 'PERMISSIONARIO STUC V2 TESTE', 1, '99999999701',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [USER_ID, `permissionario-stuc-v2-${USER_ID}@example.test`],
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
      ) VALUES ($1, $2::date, $3, $3, now(), $4, 'CONSORCIO STUC TESTE', $5, now(), now())`,
      [id, dataOrdem, valorGratuidade, userId, opaGratuidadeId],
    );
  }

  // Janela sexta-segunda (23-26/10/2026), pagamento terca 27/10/2026 - mesmas datas de
  // stuc-gratuidade-pivot.spec.ts, para continuidade com os utilitarios ja testados.
  const JANELA_4_DIAS = {
    sexta: '2026-10-23',
    sabado: '2026-10-24',
    domingo: '2026-10-25',
    segunda: '2026-10-26',
    pagamento: '2026-10-27',
  };
  // Janela terca-quinta seguinte (27-29/10/2026), pagamento sexta 30/10/2026.
  const JANELA_3_DIAS = {
    terca: '2026-10-27',
    quarta: '2026-10-28',
    quinta: '2026-10-29',
    pagamento: '2026-10-30',
  };

  // opaId e os proximos 6 ids (opaId+1..opaId+6) ficam reservados para este lote - cada
  // chamador usa um opaId espacado o suficiente (>=10) para nao colidir com o proximo lote.
  async function seedJanela4Dias(opaId: number, valores: [number, number, number, number]): Promise<void> {
    const historyId = opaId + 1;
    const detailId = opaId + 2;
    const total = valores.reduce((a, b) => a + b, 0);
    await insertOpa(opaId, JANELA_4_DIAS.pagamento, total);
    await insertHistorico(historyId, opaId, 3, '00');
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

  it('janela de 4 dias (sexta-segunda), lancamento em todos os dias: 4 colunas preenchidas com data e valor corretos', async () => {
    await seedUser();
    const opaId = BASE_ID + 10;
    await seedJanela4Dias(opaId, [10, 20, 30, 40]);

    const rows = await repository.findRows({
      dataInicio: new Date('2026-10-01T00:00:00.000Z'),
      dataFim: new Date('2026-10-31T00:00:00.000Z'),
      userIds: [USER_ID],
    });

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.status).toBe(StatusPagamento.PAGO);
    expect(row.dataOrdemPagamento1).toEqual(new Date(JANELA_4_DIAS.sexta));
    expect(row.valorOrdemPagamento1).toBe(10);
    expect(row.dataOrdemPagamento2).toEqual(new Date(JANELA_4_DIAS.sabado));
    expect(row.valorOrdemPagamento2).toBe(20);
    expect(row.dataOrdemPagamento3).toEqual(new Date(JANELA_4_DIAS.domingo));
    expect(row.valorOrdemPagamento3).toBe(30);
    expect(row.dataOrdemPagamento4).toEqual(new Date(JANELA_4_DIAS.segunda));
    expect(row.valorOrdemPagamento4).toBe(40);
    expect(row.valor).toBe(100);
  });

  it('janela de 3 dias (terca-quinta): 4a coluna fica vazia/null', async () => {
    await seedUser();
    const opaId = BASE_ID + 20;
    await seedJanela3Dias(opaId, [1, 2, 3]);

    const rows = await repository.findRows({
      dataInicio: new Date('2026-10-01T00:00:00.000Z'),
      dataFim: new Date('2026-10-31T00:00:00.000Z'),
      userIds: [USER_ID],
    });

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.dataOrdemPagamento3).toEqual(new Date(JANELA_3_DIAS.quinta));
    expect(row.valorOrdemPagamento3).toBe(3);
    expect(row.dataOrdemPagamento4).toBeNull();
    expect(row.valorOrdemPagamento4).toBeNull();
    expect(row.valor).toBe(6);
  });

  it('janela de 4 dias sem lancamento em um dos dias: aquele dia aparece com data real e valor 0 (achado 2026-10-27)', async () => {
    await seedUser();
    const opaId = BASE_ID + 30;
    const historyId = opaId + 1;
    const detailId = opaId + 2;
    await insertOpa(opaId, JANELA_4_DIAS.pagamento, 50);
    await insertHistorico(historyId, opaId, 3, '00');
    await insertDetalheA(detailId, historyId, JANELA_4_DIAS.pagamento, 50);
    // Sem ordem no sabado (posicao 2) - so sexta, domingo e segunda.
    await insertOrdemGratuidade(opaId + 3, USER_ID, JANELA_4_DIAS.sexta, 10, opaId);
    await insertOrdemGratuidade(opaId + 5, USER_ID, JANELA_4_DIAS.domingo, 15, opaId);
    await insertOrdemGratuidade(opaId + 6, USER_ID, JANELA_4_DIAS.segunda, 25, opaId);

    const rows = await repository.findRows({
      dataInicio: new Date('2026-10-01T00:00:00.000Z'),
      dataFim: new Date('2026-10-31T00:00:00.000Z'),
      userIds: [USER_ID],
    });

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.dataOrdemPagamento2).toEqual(new Date(JANELA_4_DIAS.sabado));
    expect(row.valorOrdemPagamento2).toBe(0);
    expect(row.valor).toBe(50);
  });

  it('ordens do mesmo lote em dias diferentes caem cada uma na coluna do seu proprio dia, nao na data do lote (achado 2026-10-26)', async () => {
    await seedUser();
    const opaId = BASE_ID + 40;
    await seedJanela4Dias(opaId, [11, 22, 33, 44]);

    const rows = await repository.findRows({
      dataInicio: new Date('2026-10-01T00:00:00.000Z'),
      dataFim: new Date('2026-10-31T00:00:00.000Z'),
      userIds: [USER_ID],
    });

    expect(rows).toHaveLength(1);
    const [row] = rows;
    // da."dataVencimento" (o lote) e' 27/10 - nenhuma coluna mostra essa data; cada coluna
    // mostra o dia real da ordem (23 a 26/10), prova de que dataReferenciaGrouped e' por
    // ordem (DATE(op."dataOrdem")), nao por lote.
    const colunas = [row.dataOrdemPagamento1, row.dataOrdemPagamento2, row.dataOrdemPagamento3, row.dataOrdemPagamento4];
    expect(colunas.map((d) => d?.toISOString().slice(0, 10))).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26']);
    expect(colunas.every((d) => d?.toISOString().slice(0, 10) !== JANELA_4_DIAS.pagamento)).toBe(true);
    expect([row.valorOrdemPagamento1, row.valorOrdemPagamento2, row.valorOrdemPagamento3, row.valorOrdemPagamento4]).toEqual([11, 22, 33, 44]);
  });

  describe('status principais continuam filtraveis com STUC selecionado', () => {
    // Janela terca-quinta (17-19/11/2026), pagamento sexta 20/11/2026 - faixa dedicada a este
    // describe, sem sobrepor as janelas dos testes de pivot acima.
    const WINDOW = { terca: '2026-11-17', quarta: '2026-11-18', quinta: '2026-11-19', pagamento: '2026-11-20' };

    async function seedAPagar(): Promise<void> {
      const opaId = BASE_ID + 100;
      await insertOpa(opaId, WINDOW.pagamento, 111);
      await insertHistorico(opaId + 1, opaId, 0);
      await insertDetalheA(opaId + 2, opaId + 1, WINDOW.pagamento, 111);
      await insertOrdemGratuidade(opaId + 3, USER_ID, WINDOW.terca, 111, opaId);
    }

    async function seedAguardandoPagamento(): Promise<void> {
      const opaId = BASE_ID + 110;
      await insertOpa(opaId, WINDOW.pagamento, 222);
      await insertHistorico(opaId + 1, opaId, 2);
      await insertDetalheA(opaId + 2, opaId + 1, WINDOW.pagamento, 222);
      await insertOrdemGratuidade(opaId + 3, USER_ID, WINDOW.quarta, 222, opaId);
    }

    async function seedPendenciaPaga(): Promise<void> {
      const opaPaiId = BASE_ID + 120;
      const opaFilhaId = BASE_ID + 121;
      await insertOpa(opaPaiId, WINDOW.pagamento, 333);
      await insertOpa(opaFilhaId, WINDOW.pagamento, 333, opaPaiId);
      await insertHistorico(opaFilhaId + 2, opaFilhaId, 5);
      await insertDetalheA(opaFilhaId + 3, opaFilhaId + 2, WINDOW.pagamento, 333);
      await insertOrdemGratuidade(opaFilhaId + 4, USER_ID, WINDOW.quinta, 333, opaFilhaId);
    }

    it('Pago (status 3/motivo 00) aparece quando filtrado por status ou por "Todos"', async () => {
      await seedUser();
      const opaId = BASE_ID + 10;
      await seedJanela4Dias(opaId, [1, 1, 1, 1]);

      const [filtrado, todos] = await Promise.all([
        repository.findRows({ dataInicio: new Date('2026-10-01'), dataFim: new Date('2026-10-31'), userIds: [USER_ID], statuses: [StatusPagamento.PAGO] }),
        repository.findRows({ dataInicio: new Date('2026-10-01'), dataFim: new Date('2026-10-31'), userIds: [USER_ID] }),
      ]);

      expect(filtrado).toHaveLength(1);
      expect(todos).toHaveLength(1);
      expect(todos[0].status).toBe(StatusPagamento.PAGO);
    });

    it('A Pagar, Aguardando Pagamento e Pendencia Paga continuam filtraveis, individualmente e juntos ("Todos")', async () => {
      await seedUser();
      await seedAPagar();
      await seedAguardandoPagamento();
      await seedPendenciaPaga();

      const filter = { dataInicio: new Date('2026-11-01'), dataFim: new Date('2026-11-30'), userIds: [USER_ID] };
      const [aPagar, aguardando, pendenciaPaga, todos] = await Promise.all([
        repository.findRows({ ...filter, statuses: [StatusPagamento.A_PAGAR] }),
        repository.findRows({ ...filter, statuses: [StatusPagamento.AGUARDANDO_PAGAMENTO] }),
        repository.findRows({ ...filter, statuses: [StatusPagamento.PENDENCIA_PAGA] }),
        repository.findRows(filter),
      ]);

      expect(aPagar).toHaveLength(1);
      expect(aPagar[0].status).toBe(StatusPagamento.A_PAGAR);
      expect(aguardando).toHaveLength(1);
      expect(aguardando[0].status).toBe(StatusPagamento.AGUARDANDO_PAGAMENTO);
      expect(pendenciaPaga).toHaveLength(1);
      expect(pendenciaPaga[0].status).toBe(StatusPagamento.PENDENCIA_PAGA);
      expect(new Set(todos.map((r) => r.status))).toEqual(
        new Set([StatusPagamento.A_PAGAR, StatusPagamento.AGUARDANDO_PAGAMENTO, StatusPagamento.PENDENCIA_PAGA]),
      );
    });

    // Pendencia de Pagamento (Estorno/Rejeitado) so e' consultada em dia unico - restricao
    // ja existente no legado (achado documentado em CONTEXT.md/ADR 0020, preservada aqui de
    // proposito, nao reintroduzida por esta task).
    it('Pendencia de Pagamento (Rejeitado) e filtravel em consulta de dia unico', async () => {
      await seedUser();
      const opaPaiId = BASE_ID + 130;
      const opaFilhaId = BASE_ID + 131;
      await insertOpa(opaPaiId, WINDOW.pagamento, 400);
      await insertOpa(opaFilhaId, WINDOW.pagamento, 400, opaPaiId);
      await insertHistorico(opaPaiId + 2, opaPaiId, 4, 'AR');
      await insertHistorico(opaFilhaId + 2, opaFilhaId, 0);
      await insertDetalheA(opaFilhaId + 3, opaFilhaId + 2, WINDOW.terca, 400);
      await insertOrdemGratuidade(opaFilhaId + 4, USER_ID, WINDOW.terca, 400, opaFilhaId);

      const rows = await repository.findRows({
        dataInicio: new Date(WINDOW.pagamento),
        dataFim: new Date(WINDOW.pagamento),
        userIds: [USER_ID],
        statuses: [StatusPagamento.ERRO_REJEITADO],
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe(StatusPagamento.ERRO_REJEITADO);
      expect(rows[0].valor).toBe(400);
    });
  });

  describe('edge cases', () => {
    it('soma correta por coluna quando os valores diferem por dia, sem misturar dias', async () => {
      await seedUser();
      const opaId = BASE_ID + 200;
      await seedJanela4Dias(opaId, [100, 5, 50, 2]);

      const rows = await repository.findRows({
        dataInicio: new Date('2026-10-01'),
        dataFim: new Date('2026-10-31'),
        userIds: [USER_ID],
      });

      expect(rows).toHaveLength(1);
      const [row] = rows;
      expect([row.valorOrdemPagamento1, row.valorOrdemPagamento2, row.valorOrdemPagamento3, row.valorOrdemPagamento4]).toEqual([100, 5, 50, 2]);
      expect(row.valor).toBe(157);
    });

    it('duas janelas diferentes do mesmo favorecido geram duas linhas', async () => {
      await seedUser();
      const opaId1 = BASE_ID + 210;
      const opaId2 = BASE_ID + 220;
      await seedJanela4Dias(opaId1, [10, 10, 10, 10]);
      await seedJanela3Dias(opaId2, [20, 20, 20]);

      const rows = await repository.findRows({
        dataInicio: new Date('2026-10-01'),
        dataFim: new Date('2026-10-31'),
        userIds: [USER_ID],
      });

      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.valor).sort()).toEqual([40, 60]);
    });
  });

  describe('paridade com a implementacao legada (buildStucGratuidadeQuery)', () => {
    it('janela de 4 dias: mesmas 4 colunas (data e valor) e o mesmo total que o legado', async () => {
      await seedUser();
      const opaId = BASE_ID + 300;
      await seedJanela4Dias(opaId, [10, 20, 30, 40]);

      const filter = { dataInicio: new Date('2026-10-01'), dataFim: new Date('2026-10-31'), userIds: [USER_ID] };
      const [newRows, legacyPage] = await Promise.all([
        repository.findRows(filter),
        legacyService.findFinancialMovementPage({ ...filter, stucGratuidade: true, pageSize: 50 } as any),
      ]);

      expect(newRows).toHaveLength(1);
      expect(legacyPage.data).toHaveLength(1);
      const [novo] = newRows;
      const [legado] = legacyPage.data as any[];

      expect(formatDate(novo.dataOrdemPagamento1)).toBe(legado.dataOrdemPagamento1);
      expect(novo.valorOrdemPagamento1).toBe(legado.valorOrdemPagamento1);
      expect(formatDate(novo.dataOrdemPagamento2)).toBe(legado.dataOrdemPagamento2);
      expect(novo.valorOrdemPagamento2).toBe(legado.valorOrdemPagamento2);
      expect(formatDate(novo.dataOrdemPagamento3)).toBe(legado.dataOrdemPagamento3);
      expect(novo.valorOrdemPagamento3).toBe(legado.valorOrdemPagamento3);
      expect(formatDate(novo.dataOrdemPagamento4)).toBe(legado.dataOrdemPagamento4);
      expect(novo.valorOrdemPagamento4).toBe(legado.valorOrdemPagamento4);
      expect(novo.valor).toBe(legado.valor);
      expect(novo.status).toBe(legado.status);
    });

    it('janela de 3 dias: 4a coluna vazia em ambas as implementacoes', async () => {
      await seedUser();
      const opaId = BASE_ID + 310;
      await seedJanela3Dias(opaId, [1, 2, 3]);

      const filter = { dataInicio: new Date('2026-10-01'), dataFim: new Date('2026-10-31'), userIds: [USER_ID] };
      const [newRows, legacyPage] = await Promise.all([
        repository.findRows(filter),
        legacyService.findFinancialMovementPage({ ...filter, stucGratuidade: true, pageSize: 50 } as any),
      ]);

      expect(newRows).toHaveLength(1);
      expect(legacyPage.data).toHaveLength(1);
      expect(newRows[0].dataOrdemPagamento4).toBeNull();
      expect((legacyPage.data[0] as any).dataOrdemPagamento4).toBeNull();
      expect(newRows[0].valor).toBe((legacyPage.data[0] as any).valor);
    });

    it('dia com lancamento faltante dentro da janela: mesma data real/valor 0 em ambas as implementacoes', async () => {
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

      const filter = { dataInicio: new Date('2026-10-01'), dataFim: new Date('2026-10-31'), userIds: [USER_ID] };
      const [newRows, legacyPage] = await Promise.all([
        repository.findRows(filter),
        legacyService.findFinancialMovementPage({ ...filter, stucGratuidade: true, pageSize: 50 } as any),
      ]);

      expect(newRows).toHaveLength(1);
      expect(legacyPage.data).toHaveLength(1);
      expect(formatDate(newRows[0].dataOrdemPagamento2)).toBe((legacyPage.data[0] as any).dataOrdemPagamento2);
      expect(newRows[0].valorOrdemPagamento2).toBe(0);
      expect((legacyPage.data[0] as any).valorOrdemPagamento2).toBe(0);
    });

    it('ordens do mesmo lote em dias diferentes: mesma separacao por coluna que o legado (achado 2026-10-26)', async () => {
      await seedUser();
      const opaId = BASE_ID + 330;
      await seedJanela4Dias(opaId, [11, 22, 33, 44]);

      const filter = { dataInicio: new Date('2026-10-01'), dataFim: new Date('2026-10-31'), userIds: [USER_ID] };
      const [newRows, legacyPage] = await Promise.all([
        repository.findRows(filter),
        legacyService.findFinancialMovementPage({ ...filter, stucGratuidade: true, pageSize: 50 } as any),
      ]);

      const [novo] = newRows;
      const [legado] = legacyPage.data as any[];
      expect([novo.valorOrdemPagamento1, novo.valorOrdemPagamento2, novo.valorOrdemPagamento3, novo.valorOrdemPagamento4]).toEqual([
        legado.valorOrdemPagamento1,
        legado.valorOrdemPagamento2,
        legado.valorOrdemPagamento3,
        legado.valorOrdemPagamento4,
      ]);
      expect([formatDate(novo.dataOrdemPagamento1), formatDate(novo.dataOrdemPagamento2), formatDate(novo.dataOrdemPagamento3), formatDate(novo.dataOrdemPagamento4)]).toEqual([
        legado.dataOrdemPagamento1,
        legado.dataOrdemPagamento2,
        legado.dataOrdemPagamento3,
        legado.dataOrdemPagamento4,
      ]);
    });
  });
});
