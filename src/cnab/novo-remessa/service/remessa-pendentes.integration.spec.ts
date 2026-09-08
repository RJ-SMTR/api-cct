/**
 * Integração REAL (banco LOCAL) do fluxo de REMESSA de pendentes, montando o
 * CnabModule via Test.createTestingModule. BigQuery e SFTP são MOCKADOS.
 *
 *   RUN_RETORNO_DB_TESTS=1 npx env-cmd -f .env \
 *     jest src/cnab/novo-remessa/service/remessa-pendentes.integration.spec
 *
 * Datas em 2099 => a procedure de agrupamento nao encosta em nenhum dado real.
 * Limpa tudo que criou (fixtures id >= 990000000 + linhas novas por id) e
 * restaura o NSA.
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

const B = 990000000;
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

suite('Remessa de pendentes (integração, CnabModule, BQ+SFTP mockados)', () => {
  let app: any;
  let ds: DataSource;
  let remessa: RemessaService;
  let retorno: RetornoService;
  let opaService: OrdemPagamentoAgrupadoService;
  let nsaBefore: string;
  let snap: Record<string, number> = {};

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
    for (const t of ['ordem_pagamento_agrupado', 'ordem_pagamento_agrupado_historico', 'detalhe_a', 'detalhe_b', 'header_arquivo', 'header_lote', 'ordem_pagamento']) {
      snap[t] = Number((await ds.query(`SELECT COALESCE(MAX(id),0) m FROM ${t}`))[0].m);
    }
  }, 60000);

  afterAll(async () => {
    if (ds?.isInitialized) {
      await limpar();
      await ds.query(`UPDATE setting SET value = $1 WHERE name = 'cnab_current_nsa'`, [nsaBefore]);
    }
    if (app) await app.close();
  });

  async function limpar() {
    // filhos -> pais, respeitando FKs
    await ds.query(`DELETE FROM detalhe_b WHERE "detalheAId" > $1`, [snap['detalhe_b'] ? snap['detalhe_a'] : snap['detalhe_a']]);
    await ds.query(`DELETE FROM detalhe_a WHERE id > $1`, [snap['detalhe_a']]);
    await ds.query(`DELETE FROM header_lote WHERE id > $1`, [snap['header_lote']]);
    await ds.query(`DELETE FROM header_arquivo WHERE id > $1`, [snap['header_arquivo']]);
    await ds.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id > $1 OR "ordemPagamentoAgrupadoId" >= $2`, [snap['ordem_pagamento_agrupado_historico'], B]);
    await ds.query(`DELETE FROM ordem_pagamento WHERE id >= $1`, [B]);
    // desliga o vinculo pai/filho antes de apagar
    await ds.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id >= $1 OR id > $2`, [B, snap['ordem_pagamento_agrupado']]);
    await ds.query(`DELETE FROM ordem_pagamento_agrupado WHERE id >= $1 OR id > $2`, [B, snap['ordem_pagamento_agrupado']]);
    await ds.query(`DELETE FROM public."user" WHERE id >= $1`, [B]);
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

    const ha = await ds.query(`SELECT * FROM header_arquivo WHERE id > $1 AND status = 'remessaGerado'`, [snap['header_arquivo']]);
    expect(ha.length).toBe(1);
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
});
