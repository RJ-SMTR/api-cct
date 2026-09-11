/**
 * End-to-end remittance and return coverage for normal and pending payments.
 * Run with RUN_RETORNO_DB_TESTS=1 against an isolated disposable database only.
 * Grouping procedures commit internally and select failures without a date cutoff;
 * future fixture dates cannot isolate shared data. External services are mocked.
 * Run database suites serially because fixtures share the NSA setting.
 */
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { CnabModule } from 'src/cnab/cnab.module';
import { TypeOrmConfigService } from 'src/database/typeorm-config.service';
import { RemessaService } from './remessa.service';
import { RetornoService } from './retorno.service';
import { OrdemPagamentoAgrupadoService } from './ordem-pagamento-agrupado.service';
import { SftpService } from 'src/sftp/sftp.service';
import { SftpClientService } from 'src/sftp/sftp-client/sftp-client.service';
import { BigqueryService } from 'src/bigquery/bigquery.service';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { BigqueryOrdemPagamentoRepository } from 'src/bigquery/repositories/bigquery-ordem-pagamento.repository';
import { BigqueryOrdemPagamentoGuardadorRepository } from 'src/bigquery/repositories/bigquery-ordem-pagamento-guardador.repository';
import { BigqueryTransacaoService } from 'src/bigquery/services/bigquery-transacao.service';
import { BigqueryTransacaoRepository } from 'src/bigquery/repositories/bigquery-transacao.repository';
import { HeaderName } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { CustomLogger } from 'src/utils/custom-logger';
import { buildRetornoCnab } from '../test/build-retorno-cnab';
import { remessaParaRetorno } from '../test/remessa-to-retorno';
import databaseConfig from 'src/config/database.config';
import authConfig from 'src/config/auth.config';
import appConfig from 'src/config/app.config';
import mailConfig from 'src/config/mail.config';
import fileConfig from 'src/config/file.config';
import facebookConfig from 'src/config/facebook.config';
import googleConfig from 'src/config/google.config';
import twitterConfig from 'src/config/twitter.config';
import appleConfig from 'src/config/apple.config';
import sftpConfig from 'src/config/sftp.config';
import gcsConfig from 'src/config/gcs.config';

const RUN = !!process.env.RUN_RETORNO_DB_TESTS;
const suite = RUN ? describe : describe.skip;

// base propria (retorno.integration.spec usa 990_000_000; nao pode colidir se rodarem em paralelo)
const B = 991000000;
const USER_ID = B + 1;
const OPA_FALHA = B + 10;
const OPH_FALHA = B + 20;
const OP_FALHA = B + 30;
const DA_FALHA = B + 40;
const CPF = '99999999901';
const DI = '2099-01-01';
const DF = '2099-01-31';
const DP = '2099-02-05';
const VALOR = 150;

const stub = () => ({} as any);

suite('Remessa -> Retorno (integração, CnabModule, BQ+SFTP mockados)', () => {
  let app: any;
  let ds: DataSource;
  let remessa: RemessaService;
  let retorno: RetornoService;
  let opaService: OrdemPagamentoAgrupadoService;
  let nsaBefore: string;

  beforeAll(async () => {
    (global as any).__localTzOffset = 0;
    for (const m of ['debug', 'log', 'warn', 'error'] as const) {
      jest.spyOn(CustomLogger.prototype, m).mockImplementation(() => undefined);
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig, authConfig, appConfig, mailConfig, fileConfig, facebookConfig,
            googleConfig, twitterConfig, appleConfig, sftpConfig, gcsConfig],
          envFilePath: ['.env'],
        }),
        TypeOrmModule.forRootAsync({
          useClass: TypeOrmConfigService,
          dataSourceFactory: async (options: DataSourceOptions) => new DataSource(options).initialize(),
        }),
        CnabModule,
      ],
    })
      .overrideProvider(SftpService).useValue({ getFirstRetornoPagamento: async () => null, moveToBackup: async () => undefined, submitCnabRemessa: async () => '' })
      .overrideProvider(SftpClientService).useValue(stub())
      .overrideProvider(BigqueryService).useValue(stub())
      .overrideProvider(BigqueryOrdemPagamentoService).useValue(stub())
      .overrideProvider(BigqueryOrdemPagamentoRepository).useValue(stub())
      .overrideProvider(BigqueryOrdemPagamentoGuardadorRepository).useValue(stub())
      .overrideProvider(BigqueryTransacaoService).useValue(stub())
      .overrideProvider(BigqueryTransacaoRepository).useValue(stub())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    ds = app.get(getDataSourceToken());
    remessa = app.get(RemessaService);
    retorno = app.get(RetornoService);
    opaService = app.get(OrdemPagamentoAgrupadoService);

    nsaBefore = (await ds.query(`SELECT value FROM setting WHERE name = 'cnab_current_nsa'`))[0].value;
  }, 60000);

  afterAll(async () => {
    if (ds?.isInitialized) {
      await limpar();
      await ds.query(`UPDATE setting SET value = $1 WHERE name = 'cnab_current_nsa'`, [nsaBefore]);
    }
    if (app) await app.close();
  });

  /**
   * Limpeza por RELACIONAMENTO a partir do(s) user(s) de teste [B, B+1M).
   * prepararRemessa e as procedures criam OPAs/header/detalhe com id de
   * sequencia; alcancamos tudo pelo grafo user -> ordem_pagamento -> OPA
   * (+ pai + filhas) -> oph -> detalhe_a/b, header_lote, header_arquivo.
   */
  async function limpar() {
    const opas: number[] = (await ds.query(
      `WITH RECURSIVE base AS (
         SELECT id FROM ordem_pagamento_agrupado WHERE id >= $1 AND id < $2
         UNION
         SELECT opa.id
         FROM ordem_pagamento op
         JOIN ordem_pagamento_agrupado opa ON opa.id = op."ordemPagamentoAgrupadoId"
         WHERE op."userId" >= $1 AND op."userId" < $2
         UNION
         SELECT opa.id
         FROM ordem_pagamento_guardador og
         JOIN ordem_pagamento_agrupado opa ON opa.id = og."ordemPagamentoAgrupadoId"
         WHERE og."userId" >= $1 AND og."userId" < $2
       ),
       tree AS (
         SELECT id FROM base
         UNION
         SELECT o.id FROM ordem_pagamento_agrupado o
         JOIN tree t ON o.id = (SELECT "ordemPagamentoAgrupadoId" FROM ordem_pagamento_agrupado WHERE id = t.id)
                     OR o."ordemPagamentoAgrupadoId" = t.id
       )
       SELECT id FROM tree`, [B, B + 1000000])).map((r: any) => Number(r.id));
    const inOpa = opas.length ? opas.join(',') : '-1';

    const hlIds: number[] = (await ds.query(
      `SELECT DISTINCT da."headerLoteId" hl FROM detalhe_a da
       JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
       WHERE oph."ordemPagamentoAgrupadoId" IN (${inOpa}) AND da."headerLoteId" IS NOT NULL`)).map((r: any) => Number(r.hl));
    const haIds: number[] = hlIds.length
      ? (await ds.query(`SELECT DISTINCT "headerArquivoId" ha FROM header_lote WHERE id IN (${hlIds.join(',')})`)).map((r: any) => Number(r.ha))
      : [];

    await ds.query(
      `DELETE FROM detalhe_b WHERE "detalheAId" IN (
         SELECT da.id FROM detalhe_a da JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
         WHERE oph."ordemPagamentoAgrupadoId" IN (${inOpa}))`);
    await ds.query(
      `DELETE FROM detalhe_a WHERE "ordemPagamentoAgrupadoHistoricoId" IN (
         SELECT id FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId" IN (${inOpa}))`);
    if (hlIds.length) await ds.query(`DELETE FROM header_lote WHERE id IN (${hlIds.join(',')})`);
    if (haIds.length) await ds.query(`DELETE FROM header_arquivo WHERE id IN (${haIds.join(',')})`);
    await ds.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId" IN (${inOpa})`);
    await ds.query(`DELETE FROM ordem_pagamento WHERE id >= $1 AND id < $2`, [B, B + 1000000]);
    await ds.query(`DELETE FROM ordem_pagamento_guardador WHERE id >= $1 AND id < $2`, [B, B + 1000000]);
    await ds.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id IN (${inOpa})`);
    await ds.query(`DELETE FROM ordem_pagamento_agrupado WHERE id IN (${inOpa})`);
    await ds.query(`DELETE FROM public."user" WHERE id >= $1 AND id < $2`, [B, B + 1000000]);
  }

  async function criarUser(id: number, nome = 'TESTE E2E') {
    await ds.query(
      `INSERT INTO public."user"(id, provider, "fullName", "cpfCnpj", "bankCode", "bankAccount", "bankAgency", "bankAccountDigit", "bloqueado", "createdAt", "updatedAt")
       VALUES ($1,'email',$2,$3,104,'99990001','0001','1',false,now(),now())`, [id, nome, CPF]);
  }

  /** Pagamento NORMAL: uma ordem_pagamento solta (sem OPA), consorcio STPC, na janela. */
  async function seedNormal() {
    await limpar();
    await criarUser(USER_ID, 'TESTE NORMAL');
    await ds.query(
      `INSERT INTO ordem_pagamento(id, "userId", "ordemPagamentoAgrupadoId", valor, "dataOrdem", "dataCaptura", "nomeConsorcio", "nomeOperadora", "createdAt", "updatedAt", "bqUpdatedAt")
       VALUES ($1,$2,NULL,$3,'2099-01-10','2099-01-10','STPC','TESTE NORMAL', now(), now(), now())`, [OP_FALHA, USER_ID, VALOR]);
  }

  async function seed() {
    await limpar();
    await ds.query(
      `INSERT INTO public."user"(id, provider, "fullName", "cpfCnpj", "bankCode", "bankAccount", "bankAgency", "bankAccountDigit", "bloqueado", "createdAt", "updatedAt")
       VALUES ($1,'email','TESTE PEND',$2,104,'99990001','0001','1',false,now(),now())`, [USER_ID, CPF]);
    await ds.query(
      `INSERT INTO ordem_pagamento_agrupado(id, "dataPagamento", "valorTotal", "createdAt", "updatedAt")
       VALUES ($1, '2099-01-10', $2, now(), now())`, [OPA_FALHA, VALOR]);
    await ds.query(
      `INSERT INTO ordem_pagamento_agrupado_historico(id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1,$2, now(), '104','0001','99990001','1', $3, '02')`, [OPH_FALHA, OPA_FALHA, StatusRemessaEnum.NaoEfetivado]);
    await ds.query(
      `INSERT INTO ordem_pagamento(id, "userId", "ordemPagamentoAgrupadoId", valor, "dataOrdem", "dataCaptura", "nomeConsorcio", "nomeOperadora", "createdAt", "updatedAt", "bqUpdatedAt")
       VALUES ($1,$2,$3,$4,'2099-01-10','2099-01-10','STPC','TESTE PEND', now(), now(), now())`, [OP_FALHA, USER_ID, OPA_FALHA, VALOR]);
    await ds.query(
      `INSERT INTO detalhe_a(id, "ordemPagamentoAgrupadoHistoricoId", "valorLancamento", "valorRealEfetivado", "dataVencimento", nsr, "numeroDocumentoEmpresa", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$3,'2099-01-15', 1, 1, now(), now())`, [DA_FALHA, OPH_FALHA, VALOR]);
  }

  const parentId = async (): Promise<number> =>
    (await ds.query(`SELECT "ordemPagamentoAgrupadoId" p FROM ordem_pagamento_agrupado WHERE id = $1`, [OPA_FALHA]))[0]?.p;

  const ophPaiStatus = async (pid: number): Promise<number> =>
    (await ds.query(`SELECT "statusRemessa" s FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId"=$1 ORDER BY id DESC LIMIT 1`, [pid]))[0]?.s;

  /** prepararRemessa nao aguarda o atualizaStatusRemessa (promise solta); espera ele cair */
  async function esperarStatusPai(pid: number, alvo: number, tentativas = 40): Promise<number> {
    for (let i = 0; i < tentativas; i++) {
      const s = await ophPaiStatus(pid);
      if (s === alvo) return s;
      await new Promise((r) => setTimeout(r, 100));
    }
    return ophPaiStatus(pid);
  }

  it('procedure agrupa a ordem falha numa nova ordem PAI (oph status 0)', async () => {
    await seed();
    await opaService.prepararPagamentoAgrupadosPendentes(new Date(DI), new Date(DF), new Date(DP), 'contaBilhetagem', [String(USER_ID)]);

    const pid = await parentId();
    expect(pid).toBeTruthy();
    const opaPai = (await ds.query(`SELECT * FROM ordem_pagamento_agrupado WHERE id=$1`, [pid]))[0];
    expect(Number(opaPai.valorTotal)).toBe(VALOR);
    const ophsPai = await ds.query(`SELECT * FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId"=$1`, [pid]);
    expect(ophsPai.some((o: any) => o.statusRemessa === StatusRemessaEnum.Criado)).toBe(true);
  });

  it('prepararRemessa: acha a pai, gera detalhe_a e move o oph da pai para PreparadoParaEnvio', async () => {
    await seed();
    await opaService.prepararPagamentoAgrupadosPendentes(new Date(DI), new Date(DF), new Date(DP), 'contaBilhetagem', [String(USER_ID)]);
    await remessa.prepararRemessa(new Date(DI), new Date(DF), new Date(DP), ['STPC', 'STPL', 'TEC'], false, true, [String(USER_ID)]);

    const pid = await parentId();
    expect(await esperarStatusPai(pid, StatusRemessaEnum.PreparadoParaEnvio)).toBe(StatusRemessaEnum.PreparadoParaEnvio);

    const daNova = await ds.query(
      `SELECT da.* FROM detalhe_a da JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
       WHERE oph."ordemPagamentoAgrupadoId"=$1`, [pid]);
    expect(daNova.length).toBeGreaterThan(0);

    const ha = await ds.query(
      `SELECT DISTINCT ha.* FROM header_arquivo ha
       JOIN header_lote hl ON hl."headerArquivoId" = ha.id
       JOIN detalhe_a da ON da."headerLoteId" = hl.id
       JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
       WHERE oph."ordemPagamentoAgrupadoId" = $1`, [pid]);
    expect(ha.length).toBe(1);
    expect(ha[0].status).toBe('remessaGerado');
  });

  it('gerarCnabText produz um CNAB 240 valido', async () => {
    await seed();
    await opaService.prepararPagamentoAgrupadosPendentes(new Date(DI), new Date(DF), new Date(DP), 'contaBilhetagem', [String(USER_ID)]);
    await remessa.prepararRemessa(new Date(DI), new Date(DF), new Date(DP), ['STPC', 'STPL', 'TEC'], false, true, [String(USER_ID)]);

    const txt = await remessa.gerarCnabText(HeaderName.MODAL, undefined, true);
    expect(txt.length).toBe(1);
    const linhas = txt[0].content.split(/\r?\n/).filter(Boolean);
    expect(linhas.length).toBeGreaterThan(4);
    expect(linhas.every((l: string) => l.length === 240)).toBe(true);
  });

  it('ciclo completo: remessa -> 2 retornos -> pai e filha viram PendenciaPaga', async () => {
    await seed();
    await opaService.prepararPagamentoAgrupadosPendentes(new Date(DI), new Date(DF), new Date(DP), 'contaBilhetagem', [String(USER_ID)]);
    await remessa.prepararRemessa(new Date(DI), new Date(DF), new Date(DP), ['STPC', 'STPL', 'TEC'], false, true, [String(USER_ID)]);
    await remessa.gerarCnabText(HeaderName.MODAL, undefined, true);

    const pid = await parentId();
    await esperarStatusPai(pid, StatusRemessaEnum.PreparadoParaEnvio);

    const daPai = (await ds.query(
      `SELECT da."valorLancamento" v FROM detalhe_a da JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
       WHERE oph."ordemPagamentoAgrupadoId"=$1 ORDER BY da.id DESC LIMIT 1`, [pid]))[0];
    const cnab = buildRetornoCnab([{ ocorrenciaHeaderLote: '00', registros: [{ cpf: CPF, valor: Number(daPai.v), ocorrenciaDetalheA: '00' }] }]);

    // 1a volta: PreparadoParaEnvio -> AguardandoPagamento
    await retorno.salvarRetorno({ name: 'r1.ret', content: cnab });
    expect(await ophPaiStatus(pid)).toBe(StatusRemessaEnum.AguardandoPagamento);

    // 2a volta: AguardandoPagamento -> Efetivado/PendenciaPaga + propaga para filhas
    await retorno.salvarRetorno({ name: 'r2.ret', content: cnab });
    expect([StatusRemessaEnum.Efetivado, StatusRemessaEnum.PendenciaPaga]).toContain(await ophPaiStatus(pid));

    // a filha (OPA_FALHA) tem oph em status 4 (o do relatorio) -> deve ter virado 5
    const ophFilha4 = (await ds.query(`SELECT "statusRemessa" s FROM ordem_pagamento_agrupado_historico WHERE id = $1`, [OPH_FALHA]))[0];
    expect(ophFilha4.s).toBe(StatusRemessaEnum.PendenciaPaga);
  });

  // ---- retorno gerado a partir da PROPRIA remessa (sem template fixo) ----
  describe('retorno derivado da remessa real', () => {
    async function gerarRemessaPendente(): Promise<{ pid: number; cnabRemessa: string }> {
      await seed();
      await opaService.prepararPagamentoAgrupadosPendentes(new Date(DI), new Date(DF), new Date(DP), 'contaBilhetagem', [String(USER_ID)]);
      await remessa.prepararRemessa(new Date(DI), new Date(DF), new Date(DP), ['STPC', 'STPL', 'TEC'], false, true, [String(USER_ID)]);
      const txt = await remessa.gerarCnabText(HeaderName.MODAL, undefined, true);
      const pid = await parentId();
      await esperarStatusPai(pid, StatusRemessaEnum.PreparadoParaEnvio);
      return { pid, cnabRemessa: txt[0].content };
    }

    it('remessaParaRetorno: converte a remessa e o parser le de volta', async () => {
      const { cnabRemessa } = await gerarRemessaPendente();
      const ret = remessaParaRetorno(cnabRemessa, { ocorrenciaDetalheA: '00', ocorrenciaHeaderLote: '00' });

      const linhas = ret.split(/\r?\n/).filter(Boolean);
      expect(linhas.every((l) => l.length === 240)).toBe(true);
      expect(linhas[0][142]).toBe('2'); // tipoArquivo = retorno

      const parsed: any = require('src/cnab/utils/cnab/cnab-104-utils').parseCnab240Pagamento(ret);
      const reg = parsed.lotes[0].registros[0];
      expect(reg.detalheA.ocorrencias.value.trim()).toBe('00');
      expect(parsed.lotes[0].headerLote.ocorrencias.value.trim()).toBe('00');
      expect(reg.detalheB.numeroInscricao.convertedValue.toString()).toBe(CPF);
    });

    it('remessa real -> 2 retornos "00" -> pai Efetivado/PendenciaPaga, filha PendenciaPaga', async () => {
      const { pid, cnabRemessa } = await gerarRemessaPendente();
      const ret = remessaParaRetorno(cnabRemessa, { ocorrenciaDetalheA: '00' });

      await retorno.salvarRetorno({ name: 'r1.ret', content: ret });
      expect(await ophPaiStatus(pid)).toBe(StatusRemessaEnum.AguardandoPagamento);

      await retorno.salvarRetorno({ name: 'r2.ret', content: ret });
      expect([StatusRemessaEnum.Efetivado, StatusRemessaEnum.PendenciaPaga]).toContain(await ophPaiStatus(pid));
      const ophFilha4 = (await ds.query(`SELECT "statusRemessa" s FROM ordem_pagamento_agrupado_historico WHERE id = $1`, [OPH_FALHA]))[0];
      expect(ophFilha4.s).toBe(StatusRemessaEnum.PendenciaPaga);
    });

    it('generated remittance with detail error leaves parent and child NaoEfetivado', async () => {
      const { pid, cnabRemessa } = await gerarRemessaPendente();
      const ret = remessaParaRetorno(cnabRemessa, { ocorrenciaDetalheA: 'AI' });

      await retorno.salvarRetorno({ name: 'r.ret', content: ret });
      expect(await ophPaiStatus(pid)).toBe(StatusRemessaEnum.NaoEfetivado);
      const ophFilha4 = (await ds.query(`SELECT "statusRemessa" s FROM ordem_pagamento_agrupado_historico WHERE id = $1`, [OPH_FALHA]))[0];
      expect(ophFilha4.s).toBe(StatusRemessaEnum.NaoEfetivado); // The existing child history was already NaoEfetivado.
    });
  });

  // ---- PAGAMENTO NORMAL de consorcio (p_agrupar_ordens, sem filhas) ----
  describe('pagamento normal (consorcio STPC, sem filhas)', () => {
    /** id da OPA que o p_agrupar_ordens cria para o user de teste */
    const opaNormalId = async (): Promise<number> =>
      (await ds.query(
        `SELECT DISTINCT op."ordemPagamentoAgrupadoId" id FROM ordem_pagamento op
         WHERE op."userId" = $1 AND op."ordemPagamentoAgrupadoId" IS NOT NULL`, [USER_ID]))[0]?.id;
    const statusOph = async (opaId: number): Promise<number> =>
      (await ds.query(`SELECT "statusRemessa" s FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId"=$1 ORDER BY id DESC LIMIT 1`, [opaId]))[0]?.s;
    async function esperarStatus(opaId: number, alvo: number): Promise<number> {
      for (let i = 0; i < 40; i++) {
        if ((await statusOph(opaId)) === alvo) return alvo;
        await new Promise((r) => setTimeout(r, 100));
      }
      return statusOph(opaId);
    }

    async function gerarRemessaNormal(): Promise<{ opaId: number; cnabRemessa: string }> {
      await seedNormal();
      await opaService.prepararPagamentoAgrupados(new Date(DI), new Date(DF), new Date(DP), 'contaBilhetagem', ['STPC', 'STPL', 'TEC']);
      await remessa.prepararRemessa(new Date(DI), new Date(DF), new Date(DP), ['STPC', 'STPL', 'TEC'], false);
      const txt = await remessa.gerarCnabText(HeaderName.MODAL, false, false, ['STPC', 'STPL', 'TEC']);
      const opaId = await opaNormalId();
      await esperarStatus(opaId, StatusRemessaEnum.PreparadoParaEnvio);
      return { opaId, cnabRemessa: txt[0].content };
    }

    it('p_agrupar_ordens agrupa a ordem solta numa OPA (oph status 0, sem filhas)', async () => {
      await seedNormal();
      await opaService.prepararPagamentoAgrupados(new Date(DI), new Date(DF), new Date(DP), 'contaBilhetagem', ['STPC', 'STPL', 'TEC']);

      const opaId = await opaNormalId();
      expect(opaId).toBeTruthy();
      expect(await statusOph(opaId)).toBe(StatusRemessaEnum.Criado);
      const filhas = await ds.query(`SELECT 1 FROM ordem_pagamento_agrupado WHERE "ordemPagamentoAgrupadoId" = $1`, [opaId]);
      expect(filhas.length).toBe(0);
    });

    it('prepararRemessa (normal): gera detalhe_a e move o oph para PreparadoParaEnvio', async () => {
      const { opaId } = await gerarRemessaNormal();
      expect(await statusOph(opaId)).toBe(StatusRemessaEnum.PreparadoParaEnvio);
      const da = await ds.query(
        `SELECT da.* FROM detalhe_a da JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
         WHERE oph."ordemPagamentoAgrupadoId" = $1`, [opaId]);
      expect(da.length).toBeGreaterThan(0);
    });

    it('gerarCnabText produz um CNAB 240 valido', async () => {
      const { cnabRemessa } = await gerarRemessaNormal();
      const linhas = cnabRemessa.split(/\r?\n/).filter(Boolean);
      expect(linhas.length).toBeGreaterThan(4);
      expect(linhas.every((l) => l.length === 240)).toBe(true);
    });

    it('ciclo completo: remessa real -> 2 retornos "00" -> Efetivado (sem propagacao)', async () => {
      const { opaId, cnabRemessa } = await gerarRemessaNormal();
      const ret = remessaParaRetorno(cnabRemessa, { ocorrenciaDetalheA: '00' });

      await retorno.salvarRetorno({ name: 'r1.ret', content: ret });
      expect(await statusOph(opaId)).toBe(StatusRemessaEnum.AguardandoPagamento);

      await retorno.salvarRetorno({ name: 'r2.ret', content: ret });
      expect(await statusOph(opaId)).toBe(StatusRemessaEnum.Efetivado);
    });

    it('retorno com ocorrencia de erro -> NaoEfetivado', async () => {
      const { opaId, cnabRemessa } = await gerarRemessaNormal();
      const ret = remessaParaRetorno(cnabRemessa, { ocorrenciaDetalheA: 'AI' });

      await retorno.salvarRetorno({ name: 'r.ret', content: ret });
      expect(await statusOph(opaId)).toBe(StatusRemessaEnum.NaoEfetivado);
    });
  });

  // Guardador pending-payment grouping.
  describe('pagamento pendente guardador (procedure)', () => {
    /** cria uma OPA "falha" de guardador: OPA + oph status 4 + detalhe_a + ordem_pagamento_guardador */
    async function criarFalhaGuardador(opaId: number, ophId: number, daId: number, opgId: number, valor: number) {
      await ds.query(
        `INSERT INTO ordem_pagamento_agrupado(id, "dataPagamento", "valorTotal", "createdAt", "updatedAt")
         VALUES ($1, '2099-01-10', $2, now(), now())`, [opaId, valor]);
      await ds.query(
        `INSERT INTO ordem_pagamento_agrupado_historico(id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
         VALUES ($1,$2, now(), '104','0001','99990001','1', $3, '02')`, [ophId, opaId, StatusRemessaEnum.NaoEfetivado]);
      await ds.query(
        `INSERT INTO ordem_pagamento_guardador(id, "userId", "ordemPagamentoAgrupadoId", "dataOrdem", "dataInclusao", "tipoOrdemPagamento",
           "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida", "valorRepasseGuardador", "createdAt", "updatedAt")
         OVERRIDING SYSTEM VALUE
         VALUES ($1,$2,$3,'2099-01-10','2099-01-10','pendente', 0,0,0,$4, now(), now())`, [opgId, USER_ID, opaId, valor]);
      await ds.query(
        `INSERT INTO detalhe_a(id, "ordemPagamentoAgrupadoHistoricoId", "valorLancamento", "valorRealEfetivado", "dataVencimento", nsr, "numeroDocumentoEmpresa", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$3,'2099-01-15', 1, 1, now(), now())`, [daId, ophId, valor]);
    }
    async function rodarProcedure() {
      const pagador = (await ds.query(`SELECT id FROM pagador WHERE conta = '000600071084'`))[0].id;
      await ds.query(`CALL p_agrupar_ordens_guardador_pendente($1::date, $2::date, $3::date, $4)`, [DI, DF, DP, pagador]);
    }
    const paiDe = async (opaFilha: number): Promise<number> =>
      (await ds.query(`SELECT "ordemPagamentoAgrupadoId" p FROM ordem_pagamento_agrupado WHERE id = $1`, [opaFilha]))[0]?.p;
    const ophsDe = async (opaId: number): Promise<any[]> =>
      ds.query(`SELECT "statusRemessa" s FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId" = $1`, [opaId]);

    it('1 OPA falha -> nova OPA pai (pai/filha), 1 oph pai status 0, filha ganha 1 oph novo', async () => {
      await limpar();
      await criarUser(USER_ID, 'TESTE GUARD PEND');
      await criarFalhaGuardador(B + 10, B + 20, B + 40, B + 60, 150);

      await rodarProcedure();

      const pid = await paiDe(B + 10);
      expect(pid).toBeTruthy();
      expect(pid).not.toBe(B + 10);

      const opaPai = (await ds.query(`SELECT * FROM ordem_pagamento_agrupado WHERE id=$1`, [pid]))[0];
      expect(Number(opaPai.valorTotal)).toBe(150); // sem double-count

      const ophsPai = await ophsDe(pid);
      expect(ophsPai).toHaveLength(1);
      expect(ophsPai[0].s).toBe(StatusRemessaEnum.Criado);

      const ophsFilha = await ophsDe(B + 10);
      expect(ophsFilha.filter((o) => o.s === StatusRemessaEnum.Criado)).toHaveLength(1); // 1 oph novo
      expect(ophsFilha).toHaveLength(2); // o antigo (4) + o novo (0)

      // ordem_pagamento_guardador NAO e re-vinculada
      const opg = (await ds.query(`SELECT "ordemPagamentoAgrupadoId" o FROM ordem_pagamento_guardador WHERE id = $1`, [B + 60]))[0];
      expect(opg.o).toBe(B + 10);
    });

    it('2 OPAs falha do mesmo user -> UMA pai, valorTotal = soma, 1 oph pai (nao multiplos)', async () => {
      await limpar();
      await criarUser(USER_ID, 'TESTE GUARD PEND 2');
      await criarFalhaGuardador(B + 10, B + 20, B + 40, B + 60, 100);
      await criarFalhaGuardador(B + 11, B + 21, B + 41, B + 61, 250);

      await rodarProcedure();

      const pid1 = await paiDe(B + 10);
      const pid2 = await paiDe(B + 11);
      expect(pid1).toBeTruthy();
      expect(pid1).toBe(pid2); // mesma pai

      const opaPai = (await ds.query(`SELECT * FROM ordem_pagamento_agrupado WHERE id=$1`, [pid1]))[0];
      expect(Number(opaPai.valorTotal)).toBe(350); // 100 + 250, sem multiplicar

      const ophsPai = await ophsDe(pid1);
      expect(ophsPai).toHaveLength(1); // <- o bug antigo criava 1 por ordem
      expect(ophsPai[0].s).toBe(StatusRemessaEnum.Criado);

      // cada filha ganha exatamente 1 oph novo
      expect((await ophsDe(B + 10)).filter((o) => o.s === StatusRemessaEnum.Criado)).toHaveLength(1);
      expect((await ophsDe(B + 11)).filter((o) => o.s === StatusRemessaEnum.Criado)).toHaveLength(1);
    });

    it('OPA ja efetivada (statusRemessa 3) nao entra no agrupamento', async () => {
      await limpar();
      await criarUser(USER_ID, 'TESTE GUARD OK');
      await criarFalhaGuardador(B + 10, B + 20, B + 40, B + 60, 100);
      await ds.query(`UPDATE ordem_pagamento_agrupado_historico SET "statusRemessa" = $1, "motivoStatusRemessa" = '00' WHERE id = $2`,
        [StatusRemessaEnum.Efetivado, B + 20]);

      await rodarProcedure();
      expect(await paiDe(B + 10)).toBeFalsy();
    });

    // Pending selection includes the guardador parent.
    it('getOrdensPendentes (consorcio vazio) retorna a ordem PAI de guardador', async () => {
      await limpar();
      await criarUser(USER_ID, 'TESTE GUARD F2');
      await criarFalhaGuardador(B + 10, B + 20, B + 40, B + 60, 150);
      await rodarProcedure();
      const pid = await paiDe(B + 10);

      const ordens = await opaService.getOrdensPendentes(new Date(DI), new Date(DF), [], new Date(DP));
      expect(ordens.map((o: any) => o.id)).toContain(pid);
    });

    // Complete guardador pending-payment cycle.
    const ophPaiStatusGuard = async (pid: number): Promise<number> =>
      (await ds.query(`SELECT "statusRemessa" s FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId"=$1 ORDER BY id DESC LIMIT 1`, [pid]))[0]?.s;

    async function gerarRemessaGuardadorPendente() {
      await limpar();
      await criarUser(USER_ID, 'TESTE GUARD CICLO');
      await criarFalhaGuardador(B + 10, B + 20, B + 40, B + 60, 150);
      // Exercise grouping through the service boundary.
      await opaService.prepararPagamentoAgrupadosGuardadorPendentes(new Date(DI), new Date(DF), new Date(DP), 'contaRotativo');
      await remessa.prepararRemessa(new Date(DI), new Date(DF), new Date(DP), [], false, true);
      const txt = await remessa.gerarCnabText(HeaderName.GUARDADOR, undefined, true);
      const pid = await paiDe(B + 10);
      await esperarStatusPai(pid, StatusRemessaEnum.PreparadoParaEnvio);
      return { pid, cnabRemessa: txt[0].content };
    }

    it('gerarCnabText do pendente guardador tem o CPF/nome do favorecido (getHistoricoDetalheA guardador)', async () => {
      const { cnabRemessa } = await gerarRemessaGuardadorPendente();
      const parsed: any = require('src/cnab/utils/cnab/cnab-104-utils').parseCnab240Pagamento(
        remessaParaRetorno(cnabRemessa, { ocorrenciaDetalheA: '00' }));
      const reg = parsed.lotes[0].registros[0];
      expect(reg.detalheB.numeroInscricao.convertedValue.toString()).toBe(CPF); // <- vinha vazio sem o fix
      expect(reg.detalheA.nomeTerceiro.value.trim()).not.toBe('');
    });

    it('ciclo completo guardador: remessa real -> 2 retornos "00" -> pai e filha PendenciaPaga', async () => {
      const { pid, cnabRemessa } = await gerarRemessaGuardadorPendente();
      const ret = remessaParaRetorno(cnabRemessa, { ocorrenciaDetalheA: '00' });

      await retorno.salvarRetorno({ name: 'g1.ret', content: ret });
      expect(await ophPaiStatusGuard(pid)).toBe(StatusRemessaEnum.AguardandoPagamento);

      await retorno.salvarRetorno({ name: 'g2.ret', content: ret });
      expect([StatusRemessaEnum.Efetivado, StatusRemessaEnum.PendenciaPaga]).toContain(await ophPaiStatusGuard(pid));

      const ophFilha4 = (await ds.query(`SELECT "statusRemessa" s FROM ordem_pagamento_agrupado_historico WHERE id = $1`, [B + 20]))[0];
      expect(ophFilha4.s).toBe(StatusRemessaEnum.PendenciaPaga);
    });
  });
});
