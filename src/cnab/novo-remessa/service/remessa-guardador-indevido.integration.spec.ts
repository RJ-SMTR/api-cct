/**
 * Remessa do Guardador com o desconto de pagamentos indevidos INATIVO (DESCONTAR_PAGAMENTO_INDEVIDO = false).
 * Run with RUN_RETORNO_DB_TESTS=1 against an isolated disposable LOCAL database only (ex.: api_teste).
 * O teste recusa rodar se o banco não for localhost:5432. SFTP e BigQuery são mockados e nada é enviado ao banco.
 */
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { CnabModule } from 'src/cnab/cnab.module';
import { TypeOrmConfigService } from 'src/database/typeorm-config.service';
import { DESCONTAR_PAGAMENTO_INDEVIDO, RemessaService } from './remessa.service';
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
import { CustomLogger } from 'src/utils/custom-logger';
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

// base própria (não colide com os outros specs de integração)
const B = 992000000;
const USER_ID = B + 1;
const OPG_ID = B + 60;
const NOME = 'TESTE GUARDADOR INDEVIDO';
const CPF = '99999999902';
const DI = '2099-03-10';
const DF = '2099-03-10';
const DP = '2099-03-12';
const VALOR = 200;
const SALDO_DEVEDOR = 150;

const stub = () => ({} as any);

suite('Remessa Guardador sem desconto de pagamento indevido (integração, SFTP/BQ mockados)', () => {
  let app: any;
  let ds: DataSource;
  let remessa: RemessaService;
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
          dataSourceFactory: async (options: DataSourceOptions) => {
            const o: any = options;
            // Trava de segurança: este teste grava dados e NUNCA pode apontar para a produção (túnel).
            if (o.host !== 'localhost' || Number(o.port) !== 5432) {
              throw new Error(`Banco recusado (${o.host}:${o.port}); use um banco local descartável em localhost:5432.`);
            }
            return new DataSource(options).initialize();
          },
        }),
        CnabModule,
      ],
    })
      .overrideProvider(SftpService).useValue({ getFirstRetornoPagamento: () => Promise.resolve(null), moveToBackup: () => Promise.resolve(undefined), submitCnabRemessa: () => Promise.resolve('') })
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
    opaService = app.get(OrdemPagamentoAgrupadoService);

    nsaBefore = (await ds.query(`SELECT value FROM setting WHERE name = 'cnab_current_nsa'`))[0].value;
  }, 120000);

  afterAll(async () => {
    if (ds?.isInitialized) {
      await limpar();
      await ds.query(`UPDATE setting SET value = $1 WHERE name = 'cnab_current_nsa'`, [nsaBefore]);
    }
    if (app) await app.close();
  });

  async function limpar() {
    const opas: number[] = (await ds.query(
      `SELECT DISTINCT og."ordemPagamentoAgrupadoId" id FROM ordem_pagamento_guardador og
       WHERE og."userId" = $1 AND og."ordemPagamentoAgrupadoId" IS NOT NULL`, [USER_ID])).map((r: any) => Number(r.id));
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
    await ds.query(`DELETE FROM ordem_pagamento_guardador WHERE id = $1`, [OPG_ID]);
    await ds.query(`DELETE FROM ordem_pagamento_agrupado WHERE id IN (${inOpa})`);
    await ds.query(`DELETE FROM pagamento_indevido WHERE "nomeFavorecido" = $1`, [NOME]);
    await ds.query(`DELETE FROM public."user" WHERE id = $1`, [USER_ID]);
  }

  async function seed() {
    await limpar();
    await ds.query(
      `INSERT INTO public."user"(id, provider, "fullName", "cpfCnpj", "bankCode", "bankAccount", "bankAgency", "bankAccountDigit", "bloqueado", "createdAt", "updatedAt")
       VALUES ($1,'email',$2,$3,104,'99990002','0001','1',false,now(),now())`, [USER_ID, NOME, CPF]);
    await ds.query(
      `INSERT INTO ordem_pagamento_guardador(id, "userId", "ordemPagamentoAgrupadoId", "dataOrdem", "dataInclusao", "tipoOrdemPagamento",
         "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida", "valorRepasseGuardador", "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE
       VALUES ($1,$2,NULL,$3,$3,'Manual', 0,0,0,$4, now(), now())`, [OPG_ID, USER_ID, DI, VALOR]);
    // Dívida em aberto do favorecido: com o desconto ativo, ela abateria o pagamento.
    await ds.query(
      `INSERT INTO pagamento_indevido(id, "nomeFavorecido", "valorPago", "valorPagar", "saldoDevedor", "dataReferencia")
       VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM pagamento_indevido), $1, 350, 200, $2, now())`, [NOME, SALDO_DEVEDOR]);
  }

  it('o desconto de pagamento indevido está inativo', () => {
    expect(DESCONTAR_PAGAMENTO_INDEVIDO).toBe(false);
  });

  it('gera a remessa do guardador com o valor cheio e sem alterar o saldo devedor', async () => {
    await seed();

    // Mesmos passos de CronJobsService.geradorRemessaExec para o guardador (sem enviar ao SFTP).
    await opaService.prepararPagamentoAgrupados(new Date(DI), new Date(DF), new Date(DP), 'contaRotativo', []);
    await remessa.prepararRemessa(new Date(DI), new Date(DF), new Date(DP), [], undefined);

    const [da] = await ds.query(
      `SELECT da.id, da."valorLancamento"::float AS valor, da."valorRealEfetivado"::float AS real
       FROM detalhe_a da
       JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
       JOIN ordem_pagamento_guardador og ON og."ordemPagamentoAgrupadoId" = oph."ordemPagamentoAgrupadoId"
       WHERE og.id = $1`, [OPG_ID]);
    expect(da).toBeDefined();
    expect(da.valor).toBe(VALOR); // sem desconto: valor cheio, não 50 (200 - 150) nem 0

    const [indevido] = await ds.query(`SELECT "saldoDevedor"::float AS saldo FROM pagamento_indevido WHERE "nomeFavorecido" = $1`, [NOME]);
    expect(indevido.saldo).toBe(SALDO_DEVEDOR); // dívida intacta

    const txt = await remessa.gerarCnabText(HeaderName.GUARDADOR, undefined, false, []);
    const conteudo = txt.map((t: any) => t.content).join('\n');
    const linhaA = conteudo.split(/\r?\n/).find((l: string) => l.charAt(13) === 'A' && l.includes(NOME.slice(0, 20)));
    expect(linhaA).toBeDefined();
    expect(linhaA).toContain('000000000020000'); // R$ 200,00 no CNAB (15 posições, 2 casas)
  }, 120000);
});
