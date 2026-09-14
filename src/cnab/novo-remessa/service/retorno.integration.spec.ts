/**
 * PostgreSQL integration coverage for beneficiary matching and return processing.
 * Run with RUN_RETORNO_DB_TESTS=1 against an isolated disposable database only.
 * These tests insert/update/delete fixtures; they must not use a shared database.
 * Covers normal and parent OPAs, bank-account changes, success/failure propagation
 * and CNAB parsing. Run database suites serially.
 */
import { DataSource } from 'typeorm';
import { OrdemPagamentoAgrupadoHistoricoRepository } from '../repository/ordem-pagamento-agrupado-historico.repository';
import { OrdemPagamentoAgrupadoService } from './ordem-pagamento-agrupado.service';
import { DetalheARepository } from 'src/cnab/repository/pagamento/detalhe-a.repository';
import { DetalheAService } from 'src/cnab/service/pagamento/detalhe-a.service';
import { RetornoService } from './retorno.service';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { CustomLogger } from 'src/utils/custom-logger';
import { buildRetornoCnab } from '../test/build-retorno-cnab';
import { OrdemPagamentoAgrupadoRepository } from '../repository/ordem-pagamento-agrupado.repository';

const RUN = !!process.env.RUN_RETORNO_DB_TESTS;
const suite = RUN ? describe : describe.skip;

const B = 990000000; // base dos ids de fixture (remessa-pendentes.integration usa 991_000_000)
const B_MAX = 991000000; // limite superior das fixtures deste spec
const CPF = '99999999901';
const BANK_CODE = '104';
const BANK_ACC = '99990001';

function fld(v: string) { return { value: v, convertedValue: v } as any; }
function registro(ocorrA: string, cpf = CPF, valor = 100) {
  return {
    detalheA: {
      ocorrencias: fld(ocorrA.padEnd(10, ' ')),
      valorLancamento: { convertedValue: valor },
      codigoBancoDestino: fld(BANK_CODE), codigoAgenciaDestino: fld('0001'), contaCorrenteDestino: fld(BANK_ACC),
    },
    detalheB: { numeroInscricao: { convertedValue: cpf } },
  } as any;
}
function lote(ocorrHL: string, registros: any[] = []) {
  return { headerLote: { ocorrencias: fld(ocorrHL.padEnd(10, ' ')) }, registros } as any;
}

suite('RetornoService (integração - banco real)', () => {
  let ds: DataSource;
  let retornoService: RetornoService;
  let opaService: OrdemPagamentoAgrupadoService;

  beforeAll(async () => {
    (global as any).__localTzOffset = 0;
    for (const m of ['debug', 'log', 'warn', 'error'] as const) {
      jest.spyOn(CustomLogger.prototype, m).mockImplementation(() => undefined);
    }
    // DataSource "cru" (sem entidades) => sem validacao de metadata; as queries do
    // fluxo de retorno sao SQL puro. saveStatusHistorico e servido por um repo fake.
    ds = new DataSource({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT || 5432),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'postgres',
      entities: [],
      synchronize: false,
    });
    await ds.initialize();
    const fakeHistTypeormRepo = {
      save: async (h: any) => {
        await ds.query(
          `UPDATE ordem_pagamento_agrupado_historico
             SET "statusRemessa" = $1, "dataReferencia" = now(), "motivoStatusRemessa" = $3
           WHERE id = $2`,
          [h.statusRemessa, h.id, h.motivoStatusRemessa ?? null]);
        return h;
      },
    };
    const histRepo = new OrdemPagamentoAgrupadoHistoricoRepository(fakeHistTypeormRepo as any, ds);
    opaService = new OrdemPagamentoAgrupadoService(undefined as any, undefined as any, undefined as any, histRepo, undefined as any);
    const detalheAService = new DetalheAService(new DetalheARepository(undefined as any, ds), undefined as any, undefined as any, undefined as any);
    retornoService = new RetornoService(opaService, detalheAService, { moveToBackup: async () => undefined } as any);
  });

  afterAll(async () => { await limpar(); if (ds.isInitialized) await ds.destroy(); });
  beforeEach(limpar);

  async function limpar() {
    const range = `id >= ${B} AND id < ${B_MAX}`;
    await ds.query(`DELETE FROM detalhe_a WHERE ${range}`);
    await ds.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE ${range}`);
    await ds.query(`DELETE FROM ordem_pagamento WHERE ${range}`);
    await ds.query(`DELETE FROM ordem_pagamento_agrupado WHERE ${range}`);
    await ds.query(`DELETE FROM public."user" WHERE ${range}`);
  }

  async function criarUser(id: number, opts: { bankCode?: string; bankAcc?: string } = {}) {
    await ds.query(
      `INSERT INTO public."user"(id, provider, "fullName", "cpfCnpj", "bankCode", "bankAccount", "bankAgency", "bankAccountDigit", "createdAt", "updatedAt")
       VALUES ($1,'email','TEST RETORNO',$2,$3,$4,'0001','1', now(), now())`,
      [id, CPF, opts.bankCode ?? BANK_CODE, opts.bankAcc ?? BANK_ACC]);
  }
  async function criarOpa(id: number, paiId: number | null = null, dataPagamento = '2026-09-08') {
    await ds.query(
      `INSERT INTO ordem_pagamento_agrupado(id, "dataPagamento", "valorTotal", "createdAt", "updatedAt", "ordemPagamentoAgrupadoId")
       VALUES ($1, $3::date, 100, now(), now(), $2)`, [id, paiId, dataPagamento]);
  }
  async function criarOph(id: number, opaId: number, status: StatusRemessaEnum) {
    await ds.query(
      `INSERT INTO ordem_pagamento_agrupado_historico(id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
       VALUES ($1,$2, now(), $3, '0001', $4, '1', $5)`, [id, opaId, BANK_CODE, BANK_ACC, status]);
  }
  async function criarOrdemPagamento(id: number, userId: number, opaId: number) {
    await ds.query(
      `INSERT INTO ordem_pagamento(id, "userId", "ordemPagamentoAgrupadoId", valor, "dataOrdem", "nomeConsorcio", "createdAt", "updatedAt", "bqUpdatedAt")
       VALUES ($1,$2,$3, 100, now(), 'STPC', now(), now(), now())`, [id, userId, opaId]);
  }
  async function criarDetalheA(id: number, ophId: number, valor = 100) {
    await ds.query(
      `INSERT INTO detalhe_a(id, "ordemPagamentoAgrupadoHistoricoId", "valorLancamento", "dataVencimento", nsr, "numeroDocumentoEmpresa", "createdAt", "updatedAt")
       VALUES ($1,$2,$3, now(), 1, 1, now(), now())`, [id, ophId, valor]);
  }
  const statusOph = async (id: number): Promise<number> =>
    (await ds.query(`SELECT "statusRemessa" s FROM ordem_pagamento_agrupado_historico WHERE id=$1`, [id]))[0]?.s;

  it('getDetalheARetorno acha a ordem NORMAL (via ordem_pagamento)', async () => {
    await criarUser(B + 1);
    await criarOpa(B + 10);
    await criarOph(B + 20, B + 10, StatusRemessaEnum.PreparadoParaEnvio);
    await criarOrdemPagamento(B + 30, B + 1, B + 10);
    await criarDetalheA(B + 40, B + 20, 100);

    const r = await retornoService['detalheAService'].getDetalheARetorno(CPF, 100);
    expect(r.map((d: any) => d.id)).toContain(B + 40);
  });

  it('getDetalheARetorno acha a ordem PAI de pendencia (ordem_pagamento so nas filhas)', async () => {
    await criarUser(B + 1);
    await criarOpa(B + 100);            // pai
    await criarOpa(B + 101, B + 100);   // filha -> pai
    await criarOph(B + 110, B + 100, StatusRemessaEnum.AguardandoPagamento); // oph da pai
    await criarOrdemPagamento(B + 130, B + 1, B + 101); // ordem_pagamento na FILHA
    await criarDetalheA(B + 140, B + 110, 100); // detalhe_a na PAI

    const r = await retornoService['detalheAService'].getDetalheARetorno(CPF, 100);
    expect(r.map((d: any) => d.id)).toContain(B + 140);
  });

  it('getDetalheARetorno resiste a troca de conta bancaria do usuario apos a remessa', async () => {
    // oph guarda conta antiga; user tem conta nova
    await criarUser(B + 1, { bankAcc: 'CONTA_NOVA' });
    await criarOpa(B + 10);
    await criarOph(B + 20, B + 10, StatusRemessaEnum.PreparadoParaEnvio); // userBankAccount = BANK_ACC (antiga)
    await criarOrdemPagamento(B + 30, B + 1, B + 10);
    await criarDetalheA(B + 40, B + 20, 100);

    const r = await retornoService['detalheAService'].getDetalheARetorno(CPF, 100);
    expect(r.map((d: any) => d.id)).toContain(B + 40);
  });

  it('fluxo completo NORMAL: AguardandoPagamento + "00" => Efetivado, sem propagacao', async () => {
    await criarUser(B + 1);
    await criarOpa(B + 10);
    await criarOph(B + 20, B + 10, StatusRemessaEnum.AguardandoPagamento);
    await criarOrdemPagamento(B + 30, B + 1, B + 10);
    await criarDetalheA(B + 40, B + 20, 100);

    const da = (await retornoService['detalheAService'].getDetalheARetorno(CPF, 100))[0];
    await (retornoService as any).atualizarStatusRemessaHistorico(lote('00'), registro('00'), da);

    expect(await statusOph(B + 20)).toBe(StatusRemessaEnum.Efetivado);
  });

  it('fluxo PENDENCIA: pai paga => pai e TODAS as filhas (inclusive status 4) viram PendenciaPaga', async () => {
    await criarUser(B + 1);
    await criarOpa(B + 100);            // pai
    await criarOpa(B + 101, B + 100);   // filha
    await criarOph(B + 110, B + 100, StatusRemessaEnum.AguardandoPagamento); // oph pai
    await criarOph(B + 111, B + 101, StatusRemessaEnum.NaoEfetivado);        // oph filha (o do relatorio)
    await criarOph(B + 112, B + 101, StatusRemessaEnum.PreparadoParaEnvio);  // outro oph filha
    await criarOrdemPagamento(B + 130, B + 1, B + 101);
    await criarDetalheA(B + 140, B + 110, 100); // detalhe_a na pai

    const da = (await retornoService['detalheAService'].getDetalheARetorno(CPF, 100))[0];
    await (retornoService as any).atualizarStatusRemessaHistorico(lote('00'), registro('00'), da);

    // pai: paga (Efetivado se index 0 do getHistorico, senao PendenciaPaga)
    expect([StatusRemessaEnum.Efetivado, StatusRemessaEnum.PendenciaPaga]).toContain(await statusOph(B + 110));
    expect(await statusOph(B + 111)).toBe(StatusRemessaEnum.PendenciaPaga); // filha antes NaoEfetivado (4) -> 5
    expect(await statusOph(B + 112)).toBe(StatusRemessaEnum.PendenciaPaga); // filha antes PreparadoParaEnvio (1) -> 5
  });

  it('pending return with reversal: parent and already-failed child remain NaoEfetivado', async () => {
    await criarUser(B + 1);
    await criarOpa(B + 100);
    await criarOpa(B + 101, B + 100);
    await criarOph(B + 110, B + 100, StatusRemessaEnum.AguardandoPagamento);
    await criarOph(B + 111, B + 101, StatusRemessaEnum.NaoEfetivado);
    await criarOrdemPagamento(B + 130, B + 1, B + 101);
    await criarDetalheA(B + 140, B + 110, 100);

    const da = (await retornoService['detalheAService'].getDetalheARetorno(CPF, 100))[0];
    await (retornoService as any).atualizarStatusRemessaHistorico(lote('00'), registro('02'), da);

    expect(await statusOph(B + 110)).toBe(StatusRemessaEnum.NaoEfetivado); // pai
    expect(await statusOph(B + 111)).toBe(StatusRemessaEnum.NaoEfetivado); // The child was already NaoEfetivado.
  });

  // ---- salvarRetorno de ponta a ponta: CNAB de verdade -> parseCnab240Pagamento real ----
  describe('salvarRetorno (arquivo CNAB real, parse real)', () => {
    it('NORMAL: 1a volta BD, depois 00 => AguardandoPagamento => Efetivado', async () => {
      await criarUser(B + 1);
      await criarOpa(B + 10);
      await criarOph(B + 20, B + 10, StatusRemessaEnum.PreparadoParaEnvio);
      await criarOrdemPagamento(B + 30, B + 1, B + 10);
      await criarDetalheA(B + 40, B + 20, 4497.6);

      const cnabBD = buildRetornoCnab([{ ocorrenciaHeaderLote: '00', registros: [{ cpf: CPF, valor: 4497.6, ocorrenciaDetalheA: 'BD' }] }]);
      await retornoService.salvarRetorno({ name: 'r1.ret', content: cnabBD });
      expect(await statusOph(B + 20)).toBe(StatusRemessaEnum.AguardandoPagamento);

      const cnab00 = buildRetornoCnab([{ ocorrenciaHeaderLote: '00', registros: [{ cpf: CPF, valor: 4497.6, ocorrenciaDetalheA: '00' }] }]);
      await retornoService.salvarRetorno({ name: 'r2.ret', content: cnab00 });
      expect(await statusOph(B + 20)).toBe(StatusRemessaEnum.Efetivado);
    });

    it('NORMAL: ocorrencia de erro no detalheA => NaoEfetivado', async () => {
      await criarUser(B + 1);
      await criarOpa(B + 10);
      await criarOph(B + 20, B + 10, StatusRemessaEnum.AguardandoPagamento);
      await criarOrdemPagamento(B + 30, B + 1, B + 10);
      await criarDetalheA(B + 40, B + 20, 4497.6);

      const cnab = buildRetornoCnab([{ ocorrenciaHeaderLote: '00', registros: [{ cpf: CPF, valor: 4497.6, ocorrenciaDetalheA: 'AI' }] }]);
      await retornoService.salvarRetorno({ name: 'r.ret', content: cnab });
      expect(await statusOph(B + 20)).toBe(StatusRemessaEnum.NaoEfetivado);
    });

    it('PENDENCIA: pai paga (00) => pai e filhas viram PendenciaPaga', async () => {
      await criarUser(B + 1);
      await criarOpa(B + 100);
      await criarOpa(B + 101, B + 100);
      await criarOph(B + 110, B + 100, StatusRemessaEnum.AguardandoPagamento);
      await criarOph(B + 111, B + 101, StatusRemessaEnum.NaoEfetivado);
      await criarOrdemPagamento(B + 130, B + 1, B + 101);
      await criarDetalheA(B + 140, B + 110, 4497.6);

      const cnab = buildRetornoCnab([{ ocorrenciaHeaderLote: '00', registros: [{ cpf: CPF, valor: 4497.6, ocorrenciaDetalheA: '00' }] }]);
      await retornoService.salvarRetorno({ name: 'r.ret', content: cnab });

      expect([StatusRemessaEnum.Efetivado, StatusRemessaEnum.PendenciaPaga]).toContain(await statusOph(B + 110));
      expect(await statusOph(B + 111)).toBe(StatusRemessaEnum.PendenciaPaga);
    });

    it('registro sem correspondente no banco => nao altera nada (e nao explode)', async () => {
      await criarUser(B + 1);
      await criarOpa(B + 10);
      await criarOph(B + 20, B + 10, StatusRemessaEnum.AguardandoPagamento);
      await criarOrdemPagamento(B + 30, B + 1, B + 10);
      await criarDetalheA(B + 40, B + 20, 4497.6);

      // valor que nao casa com nenhum detalhe_a
      const cnab = buildRetornoCnab([{ registros: [{ cpf: CPF, valor: 99999.99, ocorrenciaDetalheA: '00' }] }]);
      await retornoService.salvarRetorno({ name: 'r.ret', content: cnab });
      expect(await statusOph(B + 20)).toBe(StatusRemessaEnum.AguardandoPagamento);
    });
  });

  // ---- 0/1: findAllPendente enxerga a ordem pai criada pela procedure ----
  describe('agrupamento de pendentes -> findAllPendente', () => {
    const opaRepo = () => new OrdemPagamentoAgrupadoRepository({} as any, ds);
    const DP = '2026-09-08';

    it('acha a ordem PAI quando o historico esta em statusRemessa = 0', async () => {
      await criarUser(B + 1);
      await criarOpa(B + 100, null, DP);          // pai, dataPagamento = DP
      await criarOpa(B + 101, B + 100, '2026-06-01'); // filha (data antiga)
      await criarOph(B + 110, B + 100, StatusRemessaEnum.Criado); // 0

      const ordens = await opaRepo().findAllPendente(
        new Date('2026-06-01'), new Date('2026-09-30'), ['STPC', 'STPL', 'TEC'], new Date(DP));
      expect(ordens.map((o: any) => o.id)).toContain(B + 100);
    });

    it('NAO acha a ordem pai quando o historico esta em statusRemessa = 1 (era o bug)', async () => {
      await criarUser(B + 1);
      await criarOpa(B + 100, null, DP);
      await criarOpa(B + 101, B + 100, '2026-06-01');
      await criarOph(B + 110, B + 100, StatusRemessaEnum.PreparadoParaEnvio); // 1

      const ordens = await opaRepo().findAllPendente(
        new Date('2026-06-01'), new Date('2026-09-30'), ['STPC', 'STPL', 'TEC'], new Date(DP));
      expect(ordens.map((o: any) => o.id)).not.toContain(B + 100);
    });
  });
});
