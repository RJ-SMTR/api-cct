/**
 * Testes de INTEGRACAO do fluxo de retorno contra um banco Postgres REAL.
 *
 * Nao roda por padrao (precisa de banco). Para rodar:
 *   RUN_RETORNO_DB_TESTS=1 npx env-cmd -f .env jest src/cnab/novo-remessa/service/retorno.integration.spec
 *
 * Cria suas proprias fixtures (ids >= 990000000) e limpa tudo no fim.
 * Exercita as queries onde os bugs reais aconteceram:
 *  - getDetalheARetorno acha ordem normal E ordem "pai" de pendencia
 *  - getDetalheARetorno resiste a troca de conta bancaria do usuario
 *  - propagarPagamentoPaiParaFilhas propaga so quando a pai foi paga
 *  - fluxo completo: normal 1->2->3 ; pendencia pai+filhas -> 5 ; estorno -> 4 sem tocar filhas
 */
import { DataSource } from 'typeorm';
import { OrdemPagamentoAgrupadoHistoricoRepository } from '../repository/ordem-pagamento-agrupado-historico.repository';
import { OrdemPagamentoAgrupadoService } from './ordem-pagamento-agrupado.service';
import { DetalheARepository } from 'src/cnab/repository/pagamento/detalhe-a.repository';
import { DetalheAService } from 'src/cnab/service/pagamento/detalhe-a.service';
import { RetornoService } from './retorno.service';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { CustomLogger } from 'src/utils/custom-logger';

const RUN = !!process.env.RUN_RETORNO_DB_TESTS;
const suite = RUN ? describe : describe.skip;

const B = 990000000; // base dos ids de fixture
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
    await ds.query(`DELETE FROM detalhe_a WHERE id >= $1`, [B]);
    await ds.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id >= $1`, [B]);
    await ds.query(`DELETE FROM ordem_pagamento WHERE id >= $1`, [B]);
    await ds.query(`DELETE FROM ordem_pagamento_agrupado WHERE id >= $1`, [B]);
    await ds.query(`DELETE FROM public."user" WHERE id >= $1`, [B]);
  }

  async function criarUser(id: number, opts: { bankCode?: string; bankAcc?: string } = {}) {
    await ds.query(
      `INSERT INTO public."user"(id, provider, "fullName", "cpfCnpj", "bankCode", "bankAccount", "bankAgency", "bankAccountDigit", "createdAt", "updatedAt")
       VALUES ($1,'email','TEST RETORNO',$2,$3,$4,'0001','1', now(), now())`,
      [id, CPF, opts.bankCode ?? BANK_CODE, opts.bankAcc ?? BANK_ACC]);
  }
  async function criarOpa(id: number, paiId: number | null = null) {
    await ds.query(
      `INSERT INTO ordem_pagamento_agrupado(id, "dataPagamento", "valorTotal", "createdAt", "updatedAt", "ordemPagamentoAgrupadoId")
       VALUES ($1, now(), 100, now(), now(), $2)`, [id, paiId]);
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

  it('fluxo PENDENCIA: pai estornada ("02") => pai NaoEfetivado, filhas INTACTAS', async () => {
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
    expect(await statusOph(B + 111)).toBe(StatusRemessaEnum.NaoEfetivado); // filha nao mudou
  });
});
