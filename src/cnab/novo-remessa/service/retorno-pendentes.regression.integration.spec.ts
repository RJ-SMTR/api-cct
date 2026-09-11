/**
 * Regressão do fluxo de RETORNO de pendentes (docs/test-strategy-retorno-pendentes.md §7).
 *
 * Trava, como teste automático, o que o harness de golden-diff prova a fundo:
 *  - risco A: um retorno NUNCA altera uma OPH fora da família de pendentes que
 *    está sendo paga (assertivo via assertSemDanoColateral() — nenhuma OPH pré-existente muda);
 *  - propagação pai->filha só quando o pai foi pago;
 *  - idempotência: reprocessar o mesmo .ret não muda mais nada;
 *  - erro no header do lote não propaga;
 *  - o CNAB de remessa gerado tem 240 chars/linha e CPF + nome + valor do
 *    favorecido preenchidos (inclusive no pai pendente).
 *
 *   RUN_RETORNO_DB_TESTS=1 npx env-cmd -f .env \
 *     npx jest src/cnab/novo-remessa/service/retorno-pendentes.regression.integration.spec
 *
 * Banco LOCAL, com as migrations do branch aplicadas (`npm run migration:run`).
 * Datas 2099 => procedures de agrupamento não encostam em dado real. Fixtures em
 * id base 992_000_000; limpeza por relacionamento; restaura o NSA.
 *
 * Rodar a pasta inteira em SÉRIE — estes specs de integração compartilham o banco
 * e a linha `setting` do NSA, e colidem se o jest paralelizar as suítes:
 *   RUN_RETORNO_DB_TESTS=1 npx env-cmd -f .env npx jest src/cnab/novo-remessa --runInBand
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

const B = 992_000_000; // base própria (990M / 991M usados pelos outros specs)
const USER_ID = B + 1;
const OPA_FALHA = B + 10;
const OPH_FALHA = B + 20;
const OP_FALHA = B + 30;
const DA_FALHA = B + 40;
const OPG_FALHA = B + 60;
const CPF = '99999999955';
const DI = '2099-03-01';
const DF = '2099-03-31';
const DP = '2099-04-05';
const VALOR = 213.77;
const STPC = ['STPC', 'STPL', 'TEC'];

const stub = () => ({} as any);

suite('Retorno de pendentes — regressão (banco local, BQ+SFTP mockados)', () => {
  let app: any;
  let ds: DataSource;
  let remessa: RemessaService;
  let retorno: RetornoService;
  let opaService: OrdemPagamentoAgrupadoService;
  let nsaBefore: string;
  let sftpFolders: string[];

  beforeAll(async () => {
    (global as any).__localTzOffset = 0;
    for (const m of ['debug', 'log', 'warn', 'error'] as const) {
      jest.spyOn(CustomLogger.prototype, m).mockImplementation(() => undefined);
    }
    sftpFolders = [];

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
      .overrideProvider(SftpService).useValue({
        getFirstRetornoPagamento: async () => null,
        moveToBackup: async (_n: string, folder: string) => { sftpFolders.push(String(folder)); },
        submitCnabRemessa: async () => '',
      })
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

  beforeEach(() => { sftpFolders = []; });

  /** Limpeza por relacionamento a partir dos user(s)/OPA de teste [B, B+1M). */
  async function limpar() {
    const opas: number[] = (await ds.query(
      `WITH RECURSIVE base AS (
         SELECT id FROM ordem_pagamento_agrupado WHERE id >= $1 AND id < $2
         UNION SELECT opa.id FROM ordem_pagamento op
           JOIN ordem_pagamento_agrupado opa ON opa.id = op."ordemPagamentoAgrupadoId"
           WHERE op."userId" >= $1 AND op."userId" < $2
         UNION SELECT opa.id FROM ordem_pagamento_guardador og
           JOIN ordem_pagamento_agrupado opa ON opa.id = og."ordemPagamentoAgrupadoId"
           WHERE og."userId" >= $1 AND og."userId" < $2
       ), tree AS (
         SELECT id FROM base
         UNION SELECT o.id FROM ordem_pagamento_agrupado o JOIN tree t ON o.id =
           (SELECT "ordemPagamentoAgrupadoId" FROM ordem_pagamento_agrupado WHERE id = t.id)
           OR o."ordemPagamentoAgrupadoId" = t.id
       ) SELECT id FROM tree`, [B, B + 1_000_000])).map((r: any) => Number(r.id));
    const inOpa = opas.length ? opas.join(',') : '-1';

    const hlIds: number[] = (await ds.query(
      `SELECT DISTINCT da."headerLoteId" hl FROM detalhe_a da
       JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
       WHERE oph."ordemPagamentoAgrupadoId" IN (${inOpa}) AND da."headerLoteId" IS NOT NULL`)).map((r: any) => Number(r.hl));
    const haIds: number[] = hlIds.length
      ? (await ds.query(`SELECT DISTINCT "headerArquivoId" ha FROM header_lote WHERE id IN (${hlIds.join(',')})`)).map((r: any) => Number(r.ha))
      : [];

    await ds.query(`DELETE FROM detalhe_b WHERE "detalheAId" IN (SELECT da.id FROM detalhe_a da
       JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
       WHERE oph."ordemPagamentoAgrupadoId" IN (${inOpa}))`);
    await ds.query(`DELETE FROM detalhe_a WHERE "ordemPagamentoAgrupadoHistoricoId" IN (
       SELECT id FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId" IN (${inOpa}))`);
    if (hlIds.length) await ds.query(`DELETE FROM header_lote WHERE id IN (${hlIds.join(',')})`);
    if (haIds.length) await ds.query(`DELETE FROM header_arquivo WHERE id IN (${haIds.join(',')})`);
    await ds.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId" IN (${inOpa})`);
    await ds.query(`DELETE FROM ordem_pagamento WHERE id >= $1 AND id < $2`, [B, B + 1_000_000]);
    await ds.query(`DELETE FROM ordem_pagamento_guardador WHERE id >= $1 AND id < $2`, [B, B + 1_000_000]);
    await ds.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id IN (${inOpa})`);
    await ds.query(`DELETE FROM ordem_pagamento_agrupado WHERE id IN (${inOpa})`);
    await ds.query(`DELETE FROM public."user" WHERE id >= $1 AND id < $2`, [B, B + 1_000_000]);
  }

  /**
   * "Raio de impacto": estado (status+motivo) de TODAS as OPH existentes num
   * instante. `assertSemDanoColateral(antes)` confere que nenhuma OPH que já
   * existia mudou — as OPH novas criadas pelo agrupamento/remessa são ignoradas
   * (elas têm id de sequência, abaixo de B). Se uma OPH pré-existente mudar de
   * status/motivo por causa de um retorno de pendentes => risco A.
   */
  async function snapshotTodasOph(): Promise<Map<number, string>> {
    const rows: any[] = await ds.query(
      `SELECT id, "statusRemessa" s, COALESCE("motivoStatusRemessa", '') m
         FROM ordem_pagamento_agrupado_historico`);
    const m = new Map<number, string>();
    for (const r of rows) m.set(Number(r.id), `${r.s}:${r.m}`);
    return m;
  }

  async function assertSemDanoColateral(antes: Map<number, string>) {
    const depois = await snapshotTodasOph();
    const mudou: string[] = [];
    for (const [id, v] of antes) {
      if (id >= B) continue; // fixtures da própria família de teste
      const novo = depois.get(id);
      if (novo !== undefined && novo !== v) mudou.push(`oph ${id}: ${v} -> ${novo}`);
    }
    expect(mudou).toEqual([]);
  }

  async function criarUser(nome = 'REGRESSAO PEND') {
    await ds.query(
      `INSERT INTO public."user"(id, provider, "fullName", "cpfCnpj", "bankCode", "bankAccount", "bankAgency", "bankAccountDigit", "bloqueado", "createdAt", "updatedAt")
       VALUES ($1,'email',$2,$3,104,'99990055','0001','1',false,now(),now())`, [USER_ID, nome, CPF]);
  }

  async function seedPendenteConsorcio() {
    await limpar();
    await criarUser();
    await ds.query(
      `INSERT INTO ordem_pagamento_agrupado(id, "dataPagamento", "valorTotal", "createdAt", "updatedAt")
       VALUES ($1, '2099-03-10', $2, now(), now())`, [OPA_FALHA, VALOR]);
    await ds.query(
      `INSERT INTO ordem_pagamento_agrupado_historico(id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1,$2, now(), '104','0001','99990055','1', $3, '02')`, [OPH_FALHA, OPA_FALHA, StatusRemessaEnum.NaoEfetivado]);
    await ds.query(
      `INSERT INTO ordem_pagamento(id, "userId", "ordemPagamentoAgrupadoId", valor, "dataOrdem", "dataCaptura", "nomeConsorcio", "nomeOperadora", "createdAt", "updatedAt", "bqUpdatedAt")
       VALUES ($1,$2,$3,$4,'2099-03-10','2099-03-10','STPC','REGRESSAO PEND', now(), now(), now())`, [OP_FALHA, USER_ID, OPA_FALHA, VALOR]);
    await ds.query(
      `INSERT INTO detalhe_a(id, "ordemPagamentoAgrupadoHistoricoId", "valorLancamento", "valorRealEfetivado", "dataVencimento", nsr, "numeroDocumentoEmpresa", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$3,'2099-03-15', 1, 1, now(), now())`, [DA_FALHA, OPH_FALHA, VALOR]);
  }

  async function seedPendenteGuardador() {
    await limpar();
    await criarUser('REGRESSAO GUARD');
    await ds.query(
      `INSERT INTO ordem_pagamento_agrupado(id, "dataPagamento", "valorTotal", "createdAt", "updatedAt")
       VALUES ($1, '2099-03-10', $2, now(), now())`, [OPA_FALHA, VALOR]);
    await ds.query(
      `INSERT INTO ordem_pagamento_agrupado_historico(id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1,$2, now(), '104','0001','99990055','1', $3, '02')`, [OPH_FALHA, OPA_FALHA, StatusRemessaEnum.NaoEfetivado]);
    await ds.query(
      `INSERT INTO ordem_pagamento_guardador(id, "userId", "ordemPagamentoAgrupadoId", "dataOrdem", "dataInclusao", "tipoOrdemPagamento",
         "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida", "valorRepasseGuardador", "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE
       VALUES ($1,$2,$3,'2099-03-10','2099-03-10','pendente', 0,0,0,$4, now(), now())`, [OPG_FALHA, USER_ID, OPA_FALHA, VALOR]);
    await ds.query(
      `INSERT INTO detalhe_a(id, "ordemPagamentoAgrupadoHistoricoId", "valorLancamento", "valorRealEfetivado", "dataVencimento", nsr, "numeroDocumentoEmpresa", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$3,'2099-03-15', 1, 1, now(), now())`, [DA_FALHA, OPH_FALHA, VALOR]);
  }

  const paiId = async (): Promise<number> =>
    (await ds.query(`SELECT "ordemPagamentoAgrupadoId" p FROM ordem_pagamento_agrupado WHERE id = $1`, [OPA_FALHA]))[0]?.p;
  const ophPaiStatus = async (pid: number): Promise<number> =>
    (await ds.query(`SELECT "statusRemessa" s FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId"=$1 ORDER BY id DESC LIMIT 1`, [pid]))[0]?.s;
  const ophFilhaStatus = async (): Promise<number> =>
    (await ds.query(`SELECT "statusRemessa" s FROM ordem_pagamento_agrupado_historico WHERE id = $1`, [OPH_FALHA]))[0]?.s;

  async function esperarStatusPai(pid: number, alvo: number, tentativas = 60): Promise<number> {
    for (let i = 0; i < tentativas; i++) {
      if ((await ophPaiStatus(pid)) === alvo) return alvo;
      await new Promise((r) => setTimeout(r, 150));
    }
    return ophPaiStatus(pid);
  }

  /** agrupa + remessa + gerarCnabText; devolve o pai e o texto do CNAB. */
  async function gerarRemessaPendenteConsorcio(): Promise<{ pid: number; cnab: string }> {
    await seedPendenteConsorcio();
    await opaService.prepararPagamentoAgrupadosPendentes(new Date(DI), new Date(DF), new Date(DP), 'contaBilhetagem', [String(USER_ID)]);
    await remessa.prepararRemessa(new Date(DI), new Date(DF), new Date(DP), STPC, false, true, [String(USER_ID)]);
    const pid = await paiId();
    await esperarStatusPai(pid, StatusRemessaEnum.PreparadoParaEnvio);
    const txt = await remessa.gerarCnabText(HeaderName.MODAL, undefined, true);
    return { pid, cnab: txt[0].content };
  }

  // ---------------------------------------------------------------------------

  it('ciclo pendente consórcio: pai pago, filha -> PendenciaPaga, resto do banco INTACTO', async () => {
    const antes = await snapshotTodasOph();
    const { pid, cnab } = await gerarRemessaPendenteConsorcio();
    const ret = remessaParaRetorno(cnab, { ocorrenciaDetalheA: '00' });

    await retorno.salvarRetorno({ name: 'r1.ret', content: ret });
    expect(await ophPaiStatus(pid)).toBe(StatusRemessaEnum.AguardandoPagamento);

    await retorno.salvarRetorno({ name: 'r2.ret', content: ret });
    expect([StatusRemessaEnum.Efetivado, StatusRemessaEnum.PendenciaPaga]).toContain(await ophPaiStatus(pid));
    expect(await ophFilhaStatus()).toBe(StatusRemessaEnum.PendenciaPaga);

    expect(sftpFolders.every((f) => /success/i.test(f))).toBe(true);
    await assertSemDanoColateral(antes);
  }, 120000);

  it('idempotência: reprocessar o mesmo retorno 3x não muda mais nada', async () => {
    const { pid, cnab } = await gerarRemessaPendenteConsorcio();
    const ret = remessaParaRetorno(cnab, { ocorrenciaDetalheA: '00' });

    await retorno.salvarRetorno({ name: 'a.ret', content: ret });
    await retorno.salvarRetorno({ name: 'b.ret', content: ret });
    const depoisDe2 = await snapshotFamilia(pid);

    await retorno.salvarRetorno({ name: 'c.ret', content: ret });
    await retorno.salvarRetorno({ name: 'd.ret', content: ret });
    await retorno.salvarRetorno({ name: 'e.ret', content: ret });
    expect(await snapshotFamilia(pid)).toEqual(depoisDe2);
  }, 120000);

  it('estorno no pai pendente: pai NaoEfetivado, filha INTACTA, resto do banco intacto', async () => {
    const antes = await snapshotTodasOph();
    const { pid, cnab } = await gerarRemessaPendenteConsorcio();
    const ret = remessaParaRetorno(cnab, { ocorrenciaDetalheA: '02' });

    await retorno.salvarRetorno({ name: 'r.ret', content: ret });
    expect(await ophPaiStatus(pid)).toBe(StatusRemessaEnum.NaoEfetivado);
    expect(await ophFilhaStatus()).toBe(StatusRemessaEnum.NaoEfetivado); // filha não propagada (era 4)
    await assertSemDanoColateral(antes);
  }, 120000);

  it('pai falha de novo (ocorrência de erro): o HISTÓRICO MAIS RECENTE da filha também vira NaoEfetivado com o mesmo motivo (o que o relatório/grade lê)', async () => {
    // Reproduz o que o teste manual com dado real achou: o agrupamento cria um
    // oph novo (status 0) na filha, em cima do antigo (status 4). O relatório
    // lê o MAIS RECENTE - se só o pai falhar e a filha não acompanhar, a grade
    // mostra "A Pagar" indefinidamente mesmo com o pai marcado como falha.
    const antes = await snapshotTodasOph();
    const { pid, cnab } = await gerarRemessaPendenteConsorcio();
    // o oph NOVO que o agrupamento criou na filha (id de sequência real, não o
    // OPH_FALHA de id fixo do fixture - por isso exclui explicitamente, em vez
    // de "ORDER BY id DESC": o id fixo do fixture é numericamente maior que
    // qualquer nextval() da sequência real, o que inverteria a ordem de fato).
    const ophNovoDaFilha = async (): Promise<{ status: number; motivo: string }> => {
      const r = await ds.query(
        `SELECT oph."statusRemessa" s, oph."motivoStatusRemessa" m
           FROM ordem_pagamento_agrupado_historico oph
           WHERE oph."ordemPagamentoAgrupadoId" = $1 AND oph.id <> $2
           ORDER BY oph.id DESC LIMIT 1`,
        [OPA_FALHA, OPH_FALHA],
      );
      return { status: r[0].s, motivo: r[0].m };
    };

    // pré-condição: o agrupamento criou um oph novo status 0 (Criado) na
    // filha, em cima do antigo (o OPH_FALHA do seed, que fica intocado em 4).
    expect((await ophNovoDaFilha()).status).toBe(StatusRemessaEnum.Criado);

    const ret = remessaParaRetorno(cnab, { ocorrenciaDetalheA: 'AL' });
    await retorno.salvarRetorno({ name: 'r.ret', content: ret });

    expect(await ophPaiStatus(pid)).toBe(StatusRemessaEnum.NaoEfetivado);
    const filhaFinal = await ophNovoDaFilha();
    expect(filhaFinal.status).toBe(StatusRemessaEnum.NaoEfetivado);
    expect(filhaFinal.motivo.trim()).toBe('AL');
    await assertSemDanoColateral(antes);
  }, 120000);

  it('erro no header do lote (AM): tudo NaoEfetivado, sem propagação, resto intacto', async () => {
    const antes = await snapshotTodasOph();
    const { pid, cnab } = await gerarRemessaPendenteConsorcio();
    // move o pai para AguardandoPagamento com uma 1a volta ok
    await retorno.salvarRetorno({ name: '1.ret', content: remessaParaRetorno(cnab, { ocorrenciaDetalheA: '00' }) });
    expect(await ophPaiStatus(pid)).toBe(StatusRemessaEnum.AguardandoPagamento);
    // 2a volta com erro no header do lote
    await retorno.salvarRetorno({ name: '2.ret', content: remessaParaRetorno(cnab, { ocorrenciaDetalheA: '00', ocorrenciaHeaderLote: 'AM' }) });

    expect(await ophPaiStatus(pid)).toBe(StatusRemessaEnum.NaoEfetivado);
    expect(await ophFilhaStatus()).toBe(StatusRemessaEnum.NaoEfetivado); // não propagou
    await assertSemDanoColateral(antes);
  }, 120000);

  it('ciclo pendente guardador: pai pago, filha -> PendenciaPaga, resto intacto', async () => {
    const antes = await snapshotTodasOph();
    await seedPendenteGuardador();
    await opaService.prepararPagamentoAgrupadosGuardadorPendentes(new Date(DI), new Date(DF), new Date(DP), 'contaRotativo');
    await remessa.prepararRemessa(new Date(DI), new Date(DF), new Date(DP), [], false, true);
    const pid = await paiId();
    await esperarStatusPai(pid, StatusRemessaEnum.PreparadoParaEnvio);
    const txt = await remessa.gerarCnabText(HeaderName.GUARDADOR, undefined, true);
    const ret = remessaParaRetorno(txt[0].content, { ocorrenciaDetalheA: '00' });

    await retorno.salvarRetorno({ name: 'g1.ret', content: ret });
    await retorno.salvarRetorno({ name: 'g2.ret', content: ret });
    expect([StatusRemessaEnum.Efetivado, StatusRemessaEnum.PendenciaPaga]).toContain(await ophPaiStatus(pid));
    expect(await ophFilhaStatus()).toBe(StatusRemessaEnum.PendenciaPaga);
    await assertSemDanoColateral(antes);
  }, 120000);

  it('CNAB de remessa do pai pendente: 240 chars/linha, CPF + nome + valor preenchidos', async () => {
    const { cnab } = await gerarRemessaPendenteConsorcio();
    const linhas = cnab.split(/\r?\n/).filter(Boolean);
    expect(linhas.length).toBeGreaterThan(4);
    expect(linhas.every((l) => l.length === 240)).toBe(true);

    const detA = linhas.filter((l) => l[7] === '3' && l[13] === 'A');
    const detB = linhas.filter((l) => l[7] === '3' && l[13] === 'B');
    expect(detA.length).toBeGreaterThan(0);
    for (const l of detA) {
      expect(l.slice(43, 73).trim().length).toBeGreaterThan(0);          // nome favorecido
      expect(Number(l.slice(119, 134)) / 100).toBeGreaterThan(0);         // valor
    }
    for (const l of detB) {
      expect(l.slice(18, 32).replace(/\D/g, '').replace(/^0+/, '')).toBe(CPF);
    }

    // round-trip: o parser real lê o retorno derivado sem erro
    const parsed: any = require('src/cnab/utils/cnab/cnab-104-utils')
      .parseCnab240Pagamento(remessaParaRetorno(cnab, { ocorrenciaDetalheA: '00' }));
    expect(parsed.lotes[0].registros[0].detalheB.numeroInscricao.convertedValue.toString()).toBe(CPF);
  }, 120000);

  /** estado das OPH da família (pai + filhas) para comparação de idempotência. */
  async function snapshotFamilia(pid: number) {
    return ds.query(
      `SELECT oph.id, oph."statusRemessa", oph."motivoStatusRemessa"
         FROM ordem_pagamento_agrupado_historico oph
         WHERE oph."ordemPagamentoAgrupadoId" = $1
            OR oph."ordemPagamentoAgrupadoId" IN (SELECT id FROM ordem_pagamento_agrupado WHERE "ordemPagamentoAgrupadoId" = $1)
         ORDER BY oph.id`, [pid]);
  }
});
