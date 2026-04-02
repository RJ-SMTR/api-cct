import { SftpService } from 'src/sftp/sftp.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob, CronJobParameters } from 'cron';
import { HeaderName } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { RemessaService } from 'src/cnab/novo-remessa/service/remessa.service';
import { RetornoService } from 'src/cnab/novo-remessa/service/retorno.service';
import {
  isMonday,
  isSaturday,
  isSunday,
  isTuesday,
  nextMonday,
  nextTuesday,
  startOfDay,
  subDays,
} from 'date-fns';
import { CnabService } from 'src/cnab/cnab.service';
import { OrdemPagamentoService } from 'src/cnab/novo-remessa/service/ordem-pagamento.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { MailService } from 'src/mail/mail.service';
import { appSettings } from 'src/settings/app.settings';
import { cnabSettings } from 'src/settings/cnab.settings';
import { SettingEntity } from 'src/settings/entities/setting.entity';
import { ISettingData } from 'src/settings/interfaces/setting-data.interface';
import { SettingsService } from 'src/settings/settings.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { OrdemPagamentoAgrupadoService } from '../cnab/novo-remessa/service/ordem-pagamento-agrupado.service';
import { AllPagadorDict } from '../cnab/interfaces/pagamento/all-pagador-dict.interface';
import { DistributedLockService } from '../cnab/novo-remessa/service/distributed-lock.service';
import { nextFriday, nextThursday, previousFriday, isFriday, isThursday } from 'date-fns';
import { BigqueryTransacaoService } from 'src/bigquery/services/bigquery-transacao.service';


/**
 * Enum CronJobServicesJobs
 */
export enum CronJobsEnum {
  bulkSendInvites = 'bulkSendInvites',
  sendReport = 'sendReport',
  pollDb = 'pollDb',
  bulkResendInvites = 'bulkResendInvites',
  updateRetorno = 'updateRetorno',
  updateExtrato = 'updateExtrato',
  generateRemessaVLT = 'generateRemessaVLT',
  generateRemessaEmpresa = 'generateRemessaEmpresa',
  generateRemessaVanzeiros = 'generateRemessaVanzeiros',
  generateRemessaLancamento = 'generateRemessaLancamento',
  sincronizarEAgruparOrdensPagamento = 'sincronizarEAgruparOrdensPagamento',
  sincronizarTransacoesBq = 'sincronizarTransacoesBq',
  backupSftp = 'backupSftp'
}
interface ICronjobDebug {
  /** Define uma data customizada para 'hoje' */
  today?: Date;
  /** Ignora validação de cronjob*/
  force?: boolean;
}
interface ICronJob {
  name: string;
  cronJobParameters: CronJobParameters;
}

interface ICronJobSetting {
  setting: ISettingData;
  cronJob: CronJobsEnum;
  isEnabledFlag?: ISettingData;
}

/**
 * CronJob tasks and management
 */
@Injectable()
export class CronJobsService {

  private logger = new CustomLogger(CronJobsService.name, { timestamp: true });

  public jobsConfig: ICronJob[] = [];

  private static readonly MODAIS = ['STPC', 'STPL', 'TEC'];
  private static readonly CONSORCIOS = ['VLT', 'Intersul', 'Transcarioca', 'Internorte', 'MobiRio', 'Santa Cruz', 'MOBI-Rio BUM'];

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    private schedulerRegistry: SchedulerRegistry,
    private mailService: MailService,
    private mailHistoryService: MailHistoryService,
    private usersService: UsersService,
    private cnabService: CnabService,
    private ordemPagamentoAgrupadoService: OrdemPagamentoAgrupadoService,
    private remessaService: RemessaService,
    private retornoService: RetornoService,
    private sftpService: SftpService,
    private ordemPagamentoService: OrdemPagamentoService,
    private bigQueryTransacaoService: BigqueryTransacaoService,
    private distributedLockService: DistributedLockService,
  ) { }

  async onModuleInit() {
    await this.sincronizarEAgruparOrdensPagamento()
    this.onModuleLoad().catch((error: Error) => {
      throw error;
    });
  }

  async onModuleLoad() {
    await this.remessaPendenteExec('2024-04-01','2026-04-02','2026-04-02',['810016790', '463386796', 
'810020614', '810018565', '810003693', '463303416', '810005893', '462606336', '463276185', '463265783', '810010297',
'810014253', '810001554', '810014864', '810013436', '463565416', '760023200', '810006115', '760038598', '810003365',
'2597', '810018617', '810011582', '810008652', '810020207', '810016231', '810020012', '810012372', '463181049',
'810009424', '810017012', '810020942', '461323113', '810007862', '810009895', '810018024', '810006188', '810006966', 
'463156661', '810018200', '810008290', '463170364', '463575745', '810014101', '810020003', '810004906', '810006920',
'463170610', '463084508', '810010622', '810006513', '810002089', '810006036', '810007969', '463625660', '810012761', 
'810017225', '463304127', '810009822', '810009859', '810008263', '810010598', '463170197', '810004021', '810008449', 
'810007932', '810011175', '810006443', '810015779', '810018510', '464066554', '810015593', '810019498', '810007996',
'810014855', '465016857', '810010145', '810019975', '810020289', '810003222', '810001226', '810005529', '810004100',
'463676145', '463376652', '463665655', '810019470', '810003684', '810012044', '463706624', '810004669', '760035997',
'810013384', '810008227', '463386705', '810018121', '463303939', '463393716', '810011166', '810003231', '810003602',
'810013940', '810013375', '810001156', '462062275', '810010491', '810016611', '810008917', '810014590', '810012327',
'810012530', '810017377', '810003374', '810003611', '760054057', '810007561', '810017289', '810011500', '810007127', 
'810020580', '810015450', '463142668', '810003480', '810019452', '810007190', '463182486', '810015256', '810001262', 
'810009044', '461323636', '810000782', '810001217', '810000728', '810015380', '465034950', '810016505', '810015061',
'760033380', '810012017', '760071722', '463283840', '810005981', '760033399', '810020137', '810019841', '810010756', 
'810008999', '2600', '810013807', '810016277', '810013533', '810004155', '810017720', '810017340', '810018495', '810013056',
'810011865', '810004447', '810009017', '465036211', '810002131', '463344264', '810009406', '810014271', '810016356', '810013126',
'810009813', '810004960', '463181243', '810017854', '810002450', '810016532', '463415449', '463416372', '810017599', '810003453', 
'760600674', '810002104', '463130573', '810016213', '810018592', '810004562', '810018990', '463625925', '463413258', '465015997',
'810004410', '810005972', '810010589', '810018307', '810015520', '463192122', '760000838', '810017784', '810019337', '463666126', 
'810020456', '810017951', '463554555', '810013065', '810019638', '810002113', '810009026', '810019771', '810011555', '810016675',
'810017438', '810018237', '810003462', '810016204', '810001068', '760602041', '463553589', '810002797', '810008379', '810016587',
'810014439', '810002432', '810002210', '463180213', '810001688', '810002122', '810013092', '810001484', '463675948', '810018538',
'810014484', '810018468', '810011272', '810012178', '463283363', '810018723', '810015201', '810009600', '810013834', '810020854', 
'760069026', '810016709', '462115092', '463334582', '810020669', '810012114', '810016921', '810003338', '810005440', '810013506',
'810013861', '463355727', '810015399', '463386820', '810003107', '810004687', '810018529', '810006647', '810006744', '760601950',
'463706590', '810003833', '810018149', '810017401', '810015344', '810003055', '810015405', '760012145', '810001439', '810014226',
'463264601', '810013685', '463386699', '810004942', '810014785', '810019188', '810007473', '810001174', '461323317', '810006762', 
'810017146', '810011245', '810000658', '463282962', '810004128', '810017669', '810006346', '810003958', '810010525', '810016666', 
'463515271', '760600018', '810016550', '810017827', '463180967', '810012257', '810005954', '810013746', '810013791', '810006179', '461323195', 
'810009637', '810005097', '810000524', '810009211', '463625642', '463625518', '465016158', '810000232', '463192140', '810010020',
'810003790', '810019382', '810014703', '810019221', '810014305', '463495128', '810016268', '810003675', '810013144', '810017386',
'810008962', '810013676', '810011528', '810008041', '810016365', '810005361', '810020678', '810009035', '810019735', '810001712', 
'810017906', '810009178', '810015362', '810015539', '810004216', '810020155', '810018501', '463356225', '463194906', '463625581',
'810020696', '810009345', '810019027', '463356067', '810015946', '810003903', '810015089', '810017535', '463304358', '810015973',
'810011120', '810001615', '810001536', '810017997', '463376625', '463192715', '760027938', '810017003', '810012187', '810020890', 
'810008111', '810016116', '810018477', '810005176', '463386741', '810013764', '810014545', '760065079', '810014341', '810008689', 
'810014970', '810001767', '463275793', '810011430', '810009682', '810017915', '810017447', '810014730', '810012725', '810015788', 
'810012673', '760064757', '810007002', '810014086', '810001129', '463413106', '810020270', '810008023', '810000579', '463423161',
'463265455', '810020748', '463212567', '463275049', '810016383', '810007808', '810012150', '810016082', '463052299', '810005413', 
'810010303', '810008193', '810002733', '810017924', '810006416', '810010215', '810016806', '810019285', '810009451', '810009974',
'760062025', '810014721', '463212576', '810012877', '463156324', '810017173', '810020225', '810014059', '810007455', '810018273',
'463192113', '810015991', '810012929', '810012406', '810005404', '810010260', '810002344', '810008360', '810002681', '810015928',
'810000418', '810000366', '810003763', '463303498', '464013806', '810017207', '810011740', '760030099', '810016912', '760005684',
'810007039', '810011935', '810006601', '810009442', '810015760', '810011546', '810003213', '810008546', '810010473', '810003152',
'810016994', '463362738', '462552491', '760020991', '810017942', '810000126', '810003709', '465034242', '810014837', '810012390', '760600072',
'463625712', '810013366', '810014934', '810002052', '463090817', '810007613', '462626611', '760062292', '463080038', '810016958', '810012275', 
'810002645', '810019902', '810020739', '810011485', '810010534', '760032989', '461306022', '810015274', '810018811', '463386750', '463225840', 
'810000357', '810016444', '810001819', '810005200', '810013278', '810003082', '810018574', '810017304', '465035209', '810016055', '810005486', 
'810003930', '810001235', '810013728', '810015496', '463355471', '810012831', '810018413', '810010507', '810016028', '810010613', '810001095', 
'463193879', '760005019', '810016888', '810010419', '810000117', '810016134', '463214323', '810017553', '810011102', '463516487', '463224041', '810001916', '810020553', '810001581', '810007279', '810007844', '810001721', '810010190', '810004270', '465016352', '760010246', '810006841', '463180745', '810006434', '463303063', '810019294', '463303027', '810003745', '810012345', '461323292', '810010206', '463356447', '810003824', '810005219', '810004207', '810007163', '463233678', '810014457', '810001378', '810011980', '810011023', '810020085', '810015441', '810005477', '810010969', '810013214', '810001907', '810006948', '810003514', '463204058', '760053045', '465016848', '810014518', '810012859', '810007385', '810003286', '810003736', '760067057', '2500', '810001518', '810003240', '810011944', '810019212', '810010084', '810017641', '463010013', '810002308', '463054736', '810004678', '463355578', '810005778', '462115153', '463625527', '810004535', '463275252', '463352126', '810007950', '465022102', '810019805', '810007914', '463051454', '810002283', '810000038', '810015335', '810011476', '760010042', '463171075', '463192371', '463556092', '810001475', '810011014', '810005237', '810016736', '760036972', '810001794', '463453182', '810020368', '760037090', '465033948', '461323566', '810011625', '810020702', '810012743', '810014581', '810012008', '760048234', '810017474', '810010817', '810005459', '810019911', '810009512', '810004340', '810014882', '810010349', '810013667', '810014563', '810000171', '2542', '810015025', '463180824', '810002812', '810015414', '810009354', '810006461', '810020951', '810008607', '810016091', '810006814', '810019577', '810000180', '810012965', '810001660', '810016329', '810017270', '810002690', '810019364', '810015140', '463314775', '810013427', '810020313', '810011148', '810000834', '810013986', '760035146', '810015706', '463050062', '810000621', '810015885', '810002663', '810002876', '810020535', '810001457', '810007172', '810003620', '463625493', '810015955', '810014998', '810002788', '810001004', '810009503', '810005565', '465033337', '463130050', '463170771', '2626', '810009123', '810020775', '463264416', '810005741', '810004711', '810002496', '463264656', '810003879', '810010677', '463675762', '810004076', '810015371', '810004429', '810001572', '810018796', '810011360', '810000755', '810017030', '810019540', '810014013', '810004526', '810016453', '463204030', '463283655', '461314984', '810013472', '810012248', '810002229', '810019586', '810003295', '760072318', '810015797', '810009558', '810013232', '810020827', '463626539', '810003091', '810011591', '463453401', '810009008', '463130476', '760036413', '810004067', '465014921', '810016189', '810018088', '463303531', '810001785', '810016000', '810001280', '810016037', '2559', '810007181', '810018893', '810001642', '810003426', '810005945', '760601039', '810000931', '810002362', '810009734', '810009673', '463181562', '810017711', '810013287', '463665956', '463140103', '810002317', '810019328', '810017076',
'810000940', '810016462', '463494930', '810135798', '810009433', '760018374', '810019081', '461323557', '810014961'])


    const THIS_CLASS_WITH_METHOD = 'CronJobsService.onModuleLoad';
    this.jobsConfig.push(
      {
        /**
         * Job interno.
         * NÃO REMOVER ESTE JOB, É ÚTIL PARA ALTERAR OS CRONJOBS EM CASO DE URGÊNCIA
         */
        name: CronJobsEnum.pollDb,
        cronJobParameters: {
          // cronjob: * * * * - A cada minuto
          cronTime: (await this.settingsService.getOneBySettingData(appSettings.any__poll_db_cronjob, true, THIS_CLASS_WITH_METHOD)).getValueAsString(),
          onTick: async () => await this.pollDb(),
        },
      },
      {
        /**
         * Atualizar Retorno - Leitura dos Arquivos Retorno do Banco CEF para CCT - todo dia, a cada 30m
         *
         * Não executa quando gerar o remessa.
         */
        name: CronJobsEnum.updateRetorno,
        cronJobParameters: {
          cronTime: '*/30 * * * *', //  Every 30 min
          onTick: async () => {
            await this.retornoExec();
          },
        },
      },
      {
        /**
         * Atualizar Extrato - Leitura dos Arquivos de Extrato Retorno do Banco CEF para CCT - todo dia
         *
         * Não executa quando gerar o remessa.
         */
        name: CronJobsEnum.updateExtrato,
        cronJobParameters: {
          cronTime: '*/30 * * * *', //  Every 30 min
          onTick: async () => {
            await this.readRetornoExtrato();
          },
        },
      },

      {
        /**
         * Envio de Relatório Estatística dos Dados - todo dia, 06:00 - 06:01
         *
         * NÃO DESABILITAR ENVIO DE REPORT - Every day, 09:00 GMT = 06:00 BRT (GMT-3)
         *
         * Envio relatório estatística
         */
        name: CronJobsEnum.sendReport,
        cronJobParameters: {
          cronTime: (await this.settingsService.getOneBySettingData(appSettings.any__mail_report_cronjob,
            true, THIS_CLASS_WITH_METHOD)).getValueAsString(),
          onTick: async () => await this.sendStatusReport(),
        },
      },
      {
        /**
         * Gerar arquivo remessa do Consórcio VLT - 2a-6a, 08:00, duração: 15 min       
         *
         * Gerar remessa VLT
         */
        name: CronJobsEnum.generateRemessaVLT,
        cronJobParameters: {
          cronTime: '0 12 * * *', // Every day, 12:00 GMT = 9:00 BRT (GMT-3)
          onTick: async () => {
            const today = new Date();
            if (isSaturday(today) || isSunday(today)) {
              return;
            }
          },
        },
      },
      {
        /**
         * Gerar arquivo remessa dos vanzeiros - toda 6a, 10:00, duração: 15 min         
         *
         * Gerar remessa vanzeiros
         */
        name: CronJobsEnum.generateRemessaVanzeiros,
        cronJobParameters: {
          cronTime: '0 13 * * FRI', // Rodar todas as sextas 13:00 GMT = 10:00 BRT (GMT-3)
          onTick: async () => {
            // await this.remessaModalExec(); 
          },
        },
      },
      {
        /**
         * Gerar arquivo Remessa dos Consórcios - toda 6a
         *
         * Gerar remessa consórcios
         */
        name: CronJobsEnum.generateRemessaEmpresa,
        cronJobParameters: {
          cronTime: '0 12 * * FRI', // Rodar todas as sextas 12:00 GMT = 09:00 BRT (GMT-3)
          onTick: async () => {
            // await this.remessaConsorciosExec();
          },
        },
      },
      {
        /**
         * Reenvio de E-mail para Vanzeiros - 1 aceso ou Cadastro de Contas Bancárias - dia 15 de cada mês, 11:45, duração: 5 min
         *
         * Reenvio de emails para vanzeiros
         */
        name: CronJobsEnum.bulkResendInvites,
        cronJobParameters: {
          cronTime: '45 14 15 * *', // Day 15, 14:45 GMT = 11:45 BRT (GMT-3)
          onTick: async () => await this.bulkResendInvites(),
        },
      },
      {
        /**
         * Envio do E-mail - Convite para o usuário realizar o 1o acesso no Sistema CCT - todo dia, 19:00, duração: 5 min
         *
         * 19:00 BRT (GMT-3) = 22:00 GMT (10PM)
         */
        name: CronJobsEnum.bulkSendInvites,
        cronJobParameters: {
          cronTime: (await this.settingsService.getOneBySettingData(appSettings.any__mail_invite_cronjob, true, THIS_CLASS_WITH_METHOD)).getValueAsString(),
          onTick: async () => await this.bulkSendInvites(),
        },
      },
      {
        /**
         * Sincroniza e agrupa ordens de pagamento.
         * */
        name: CronJobsEnum.sincronizarEAgruparOrdensPagamento,
        cronJobParameters: {
          cronTime: "0 9-21 * * *", // 06:00 BRT (GMT-3) = 09:00 GMT, 18:00 BRT (GMT-3) = 21:00 GMT
          onTick: async () => await this.sincronizarEAgruparOrdensPagamento(),
        },
      },
      {
        /**
         *
         * Atualizar Backup do SFTP - Leitura dos Arquivos do SFTP
         * 
         */
        name: CronJobsEnum.backupSftp,
        cronJobParameters: {
          cronTime: "0 23 * * *", //  Todo dia as 20:00 
          onTick: async () => {
            await this.fullBackup();
          },
        },
      },
      // {
      //   /**
      //    * Sincroniza transacoes do BQ.
      //    * */
      //   name: CronJobsEnum.sincronizarTransacoesBq,
      //   cronJobParameters: {
      //     cronTime: "0 12 * * *", // 07:00 BRT (GMT-3) = 10:00 GMT, 21:00 BRT (GMT-3) = 24:00 GMT
      //     onTick: async () => await this.sincronizarTransacoesBq(),
      //   },
      // }
    );

    /** NÃO COMENTE ISTO, É A GERAÇÃO DE JOBS */
    if (process.env.CRONJOBS != 'false') {
      for (const jobConfig of this.jobsConfig) {
        this.startCron(jobConfig);
        this.logger.log(`Tarefa agendada: ${jobConfig.name}, ${jobConfig.cronJobParameters.cronTime}`);
      }
    } else {
      this.logger.warn(`env->CRONJOBS = false. Cronjobs inativos.`);
    }
  }

  /**
   * Verifica se o ambiente é realmente produção, pois:
   * - É produção se .env -> nodeEnv = production, Banco -> settings.api_env = production
   * - É staging se .env -> nodeEnv = production, Banco -> settings.api_env = staging
   */
  public async getIsProd(method?: string) {
    const apiEnv = await this.settingsService.getOneBySettingData(appSettings.any__api_env);
    const nodeEnv = this.configService.getOrThrow('app.nodeEnv', { infer: true });
    const isProd = nodeEnv === 'production' && apiEnv.getValueAsString() === 'production';
    if (method !== undefined && !isProd) {
      this.logger.log(`Tarefa ignorada pois a variável 'nodeEnv' e no banco o 'production' não estão definidos para 'production' (nodeEnv: ${nodeEnv}, settings.api_env: ${apiEnv.getValueAsString()})`, method);
    }
    return isProd;
  }

  /**
   * Verifica se os cornjobs de envio de CNAB estão ativos no banco de dados.
   */
  async getIsCnabJobEnabled(method?: string) {
    const cnabJobEnabled = await this.settingsService.getOneBySettingData(cnabSettings.any__cnab_jobs_enabled);
    if (method !== undefined && !cnabJobEnabled.getValueAsBoolean()) {
      this.logger.log(`Tarefa ignorada pois está desabilitada em ${cnabSettings.any__cnab_jobs_enabled.name}`, method);
    }
    return cnabJobEnabled.getValueAsBoolean();
  }

  startCron(jobConfig: ICronJob) {
    const job = new CronJob(jobConfig.cronJobParameters);
    this.schedulerRegistry.addCronJob(jobConfig.name, job);
    job.start();
  }


  deleteCron(jobName: string) {
    this.schedulerRegistry.deleteCronJob(jobName);
  }

  async bulkSendInvites() {
    const METHOD = this.bulkSendInvites.name;
    try {
      const activateAutoSendInvite = await this.settingsService.findOneBySettingData(appSettings.any__activate_auto_send_invite);
      if (!activateAutoSendInvite) {
        this.logger.log(`Tarefa cancelada pois 'setting.${appSettings.any__activate_auto_send_invite.name}' ` + ' não foi encontrado no banco.', METHOD);
        return;
      } else if (activateAutoSendInvite.getValueAsBoolean() === false) {
        this.logger.log(`Tarefa cancelada pois 'setting.${appSettings.any__activate_auto_send_invite.name}' = 'false'.` + ` Para ativar, altere na tabela 'setting'`, METHOD);
        return;
      }

      // get data
      const sentToday = (await this.mailHistoryService.findSentToday()) || [];
      const unsent = (await this.mailHistoryService.findUnsent()) || [];
      const remainingQuota = await this.mailHistoryService.getRemainingQuota();
      const dailyQuota = () => this.configService.getOrThrow('mail.dailyQuota');

      this.logger.log(`Iniciando tarefa - a enviar: ${unsent.length},enviado: ${sentToday.length}/${dailyQuota()},falta enviar: ${remainingQuota}`, METHOD);
      for (let i = 0; i < remainingQuota && i < unsent.length; i++) {
        const invite = new MailHistory(unsent[i]);

        const user = await this.usersService.findOne({ id: invite.user.id });

        // User mail error
        if (!user?.email) {
          this.logger.error(`Usuário não tem email válido (${user?.email}), este email não será enviado.`, METHOD);
          invite.setInviteError({
            httpErrorCode: HttpStatus.UNPROCESSABLE_ENTITY,
            smtpErrorCode: null,
          });
          invite.sentAt = null;
          invite.failedAt = new Date(Date.now());
          await this.mailHistoryService.update(
            invite.id,
            {
              httpErrorCode: invite.httpErrorCode,
              smtpErrorCode: invite.smtpErrorCode,
              sentAt: invite.sentAt,
              failedAt: invite.failedAt,
            },
            METHOD,
          );
          continue;
        }

        // Send mail
        try {
          const { mailSentInfo } = await this.mailService.sendConcludeRegistration({
            to: user.email,
            data: {
              hash: invite.hash,
              userName: user?.fullName as string,
            },
          });

          // Success
          if (mailSentInfo.success === true) {
            invite.setInviteError({
              httpErrorCode: null,
              smtpErrorCode: null,
            });
            invite.setInviteStatus(InviteStatusEnum.sent);
            invite.sentAt = new Date(Date.now());
            invite.failedAt = null;
            await this.mailHistoryService.update(
              invite.id,
              {
                inviteStatus: invite.inviteStatus,
                httpErrorCode: invite.httpErrorCode,
                smtpErrorCode: invite.smtpErrorCode,
                sentAt: invite.sentAt,
                failedAt: invite.failedAt,
              },
              METHOD,
            );
            this.logger.log('Email enviado com sucesso.', METHOD);
          }

          // SMTP error
          else {
            this.logger.error(`Email enviado retornou erro. - mailSentInfo: ${mailSentInfo}`, new Error().stack, METHOD);
            invite.setInviteError({
              httpErrorCode: HttpStatus.INTERNAL_SERVER_ERROR,
              smtpErrorCode: mailSentInfo.response.code,
            });
            invite.sentAt = null;
            invite.failedAt = new Date(Date.now());
            await this.mailHistoryService.update(
              invite.id,
              {
                httpErrorCode: invite.httpErrorCode,
                smtpErrorCode: invite.smtpErrorCode,
                sentAt: invite.sentAt,
                failedAt: invite.failedAt,
              },
              METHOD,
            );
          }

          // API error
        } catch (httpException) {
          this.logger.error('Email falhou ao enviar.', httpException.stack, METHOD);
          invite.httpErrorCode = httpException.statusCode;
          invite.setInviteError({
            httpErrorCode: HttpStatus.INTERNAL_SERVER_ERROR,
            smtpErrorCode: null,
          });
          invite.sentAt = null;
          invite.failedAt = new Date(Date.now());
          await this.mailHistoryService.update(
            invite.id,
            {
              httpErrorCode: invite.httpErrorCode,
              smtpErrorCode: invite.smtpErrorCode,
              sentAt: invite.sentAt,
              failedAt: invite.failedAt,
            },
            METHOD,
          );
        }
      }
      if (unsent.length == 0 || remainingQuota == 0) {
        const reasons: string[] = [...(unsent.length == 0 ? ['no mails to sent'] : []), ...(remainingQuota == 0 ? ['no remaining quota'] : [])];
        this.logger.log(`Tarefa cancelada pois ${reasons.join(' e ')}`, METHOD);
      } else {
        this.logger.log('Tarefa finalizada com sucesso.', METHOD);
      }
    } catch (error) {
      this.logger.error('Erro ao executar tarefa.', error?.stack, METHOD);
    }
  }

  async sendStatusReport() {
    const METHOD = this.sendStatusReport.name;
    try {
      if (!(await this.getIsProd(METHOD))) {
        return;
      }
      await this.mailService.runStatusReportJob(this.logger, METHOD);
    } catch (error) {
      this.logger.error('Erro ao executar tarefa.', error?.stack, METHOD);
    }
  }

  async pollDb() {
    const METHOD = this.pollDb.name;
    try {
      const settingPollDbActive = await this.settingsService.findOneBySettingData(appSettings.any__poll_db_enabled);
      if (!settingPollDbActive) {
        this.logger.error(`Tarefa cancelada pois 'setting.${appSettings.any__poll_db_enabled.name}' não foi encontrado no banco.`, new Error().stack, METHOD);
        return;
      }
      if (!settingPollDbActive.getValueAsBoolean()) {
        return;
      }

      const cronjobSettings: ICronJobSetting[] = [
        {
          setting: appSettings.any__poll_db_cronjob,
          cronJob: CronJobsEnum.pollDb,
        },
        {
          setting: appSettings.any__mail_invite_cronjob,
          cronJob: CronJobsEnum.bulkSendInvites,
        },
        {
          setting: appSettings.any__mail_report_cronjob,
          cronJob: CronJobsEnum.sendReport,
        },
      ];
      for (const setting of cronjobSettings) {
        await this.handleCronjobSettings(setting, METHOD);
      }
    } catch (error) {
      this.logger.error(`Erro ao executar tarefa.`, error?.stack, METHOD);
    }
  }

  async handleCronjobSettings(args: ICronJobSetting, thisMethod: string): Promise<boolean> {
    const { settingFound, isSettingValid } = await this.validateCronjobSetting(args, thisMethod);
    if (!settingFound || !isSettingValid) {
      return false;
    }
    const setting = settingFound.getValueAsString();
    const jobIndex = this.jobsConfig.findIndex((i) => i.name === args.cronJob);
    const job = this.jobsConfig[jobIndex];
    if (job.cronJobParameters.cronTime !== setting) {
      this.logger.log(`Alteração encontrada em` + ` setting.'${args.setting.name}': ` + `${job?.cronJobParameters.cronTime} --> ${setting}.`, thisMethod);
      job.cronJobParameters.cronTime = setting;
      this.jobsConfig[jobIndex] = job;
      this.deleteCron(job.name);
      this.startCron(job);
      this.logger.log(`Tarefa reagendada: ${job.name}, ${job.cronJobParameters.cronTime}`, thisMethod);
      return true;
    }
    return false;
  }

  async validateCronjobSetting(
    args: ICronJobSetting,
    thisMethod: string,
  ): Promise<{
    settingFound: SettingEntity | null;
    isEnabledSetting: SettingEntity | null;
    isSettingValid: boolean;
  }> {
    const settingFound = await this.settingsService.findOneBySettingData(args.setting);
    if (!settingFound) {
      return {
        settingFound: null,
        isEnabledSetting: null,
        isSettingValid: false,
      };
    }
    if (!args?.isEnabledFlag) {
      return {
        settingFound: settingFound,
        isEnabledSetting: null,
        isSettingValid: true,
      };
    }

    const isEnabledFlag = await this.settingsService.getOneBySettingData(args.isEnabledFlag, true, thisMethod);
    if (!isEnabledFlag.getValueAsBoolean()) {
      return {
        settingFound: settingFound,
        isEnabledSetting: isEnabledFlag,
        isSettingValid: false,
      };
    }

    return {
      settingFound: settingFound,
      isEnabledSetting: isEnabledFlag,
      isSettingValid: true,
    };
  }

  async bulkResendInvites(): Promise<HttpStatus> {
    const METHOD = this.bulkResendInvites.name;
    try {
      const notRegisteredUsers = await this.usersService.getNotRegisteredUsers();

      if (notRegisteredUsers.length === 0) {
        this.logger.log('Não há usuários para enviar, abortando...', METHOD);
        return HttpStatus.NOT_FOUND;
      }
      this.logger.log('Enviando emails específicos para ' + `${notRegisteredUsers.length} usuários não totalmente registrados`, METHOD);
      for (const user of notRegisteredUsers) {
        await this.resendInvite(user, METHOD);
      }
      return HttpStatus.OK;
    } catch (error) {
      this.logger.error(`Erro ao executar tarefa, abortando. - ${error}`, error?.stack, METHOD);
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  async resendInvite(user: User, outerMethod: string) {
    const METHOD = `${outerMethod} > ${this.resendInvite.name}`;
    try {
      const mailSentInfo = await this.mailService.reSendEmailBank({
        to: user.email as string,
        data: {
          hash: user.aux_inviteHash as string,
          inviteStatus: user.aux_inviteStatus as InviteStatus,
        },
      });

      // Success
      if (mailSentInfo.success) {
        const mailHistory = await this.mailHistoryService.getOne({
          user: { email: user.email as string },
        });
        this.logger.log(`Email enviado com sucesso para ${mailSentInfo.envelope.to}. (último envio: ${mailHistory.sentAt?.toISOString()})`, METHOD);
        await this.mailHistoryService.update(mailHistory.id, {
          sentAt: new Date(Date.now()),
        });
      } else {
        this.logger.error('Email enviado retornou erro.' + ` - mailSentInfo: ${JSON.stringify(mailSentInfo)}`, new Error().stack, METHOD);
      }
    } catch (httpException) {
      this.logger.error(`Erro ao executar tarefa, abortando. - ${httpException}`, httpException?.stack, METHOD);
    }
  }

  async readRetornoExtrato() {
    const METHOD = 'readRetornoExtrato';
    try {
      await this.cnabService.readRetornoExtrato();
      this.logger.log('Tarefa finalizada com sucesso.', METHOD);
    } catch (error) {
      this.logger.error(`Erro ao executar tarefa, abortando. - ${error}`, error?.stack, METHOD);
    }
  }

  private async geradorRemessaExec(dataInicio: Date, dataFim: Date, dataPagamento: Date,
    consorcios: string[], headerName: HeaderName, pagamentoUnico?: boolean) {
    // Agrupa pagamentos        

    for (let index = 0; index < consorcios.length; index++) {
      if (pagamentoUnico) {
        await this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupadosUnico(dataInicio,
          dataFim, dataPagamento, "cett", [consorcios[index]]);
      } else {
        await this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupados(dataInicio,
          dataFim, dataPagamento, "contaBilhetagem", [consorcios[index]]);
      }
    }

    // //Prepara o remessa
     await this.remessaService.prepararRemessa(dataInicio, dataFim, dataPagamento, consorcios, pagamentoUnico);
    // Gera o TXT
    const txt = await this.remessaService.gerarCnabText(headerName, pagamentoUnico);
    //Envia para o SFTP
    await this.remessaService.enviarRemessa(txt, headerName);
  }

  async remessaPendenteExec(dtInicio: string, dtFim: string, dataPagamento?: string, idOperadoras?: string[]) {
    const today = new Date();
    const dataInicio = new Date(dtInicio);
    const dataFim = new Date(dtFim);
    await this.geradorRemessaPendenteExec(dataInicio, dataFim, dataPagamento ? new Date(dataPagamento) : today,
      HeaderName.MODAL, idOperadoras);
  }

  private async geradorRemessaPendenteExec(dataInicio: Date, dataFim: Date, dataPagamento: Date,
    headerName: HeaderName, idOperadoras?: string[]) {
    this.logger.debug('iniciando o agrupamento pendente')
    if (dataInicio)
      // AGRUPAR ORDENS POR INDIVIDUO
      await this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupadosPendentes(dataInicio, dataFim, dataPagamento, "contaBilhetagem", idOperadoras);

    // Prepara o remessa
    await this.remessaService.prepararRemessa(dataInicio, dataFim, dataPagamento, ['STPC', 'STPL', 'TEC'], false, true, idOperadoras);

    // Gera o TXT
    const txt = await this.remessaService.gerarCnabText(headerName, undefined, true);

    //Envia para o SFTP
    await this.remessaService.enviarRemessa(txt, headerName);
  }

  async remessaModalExec(pagamentoUnico?: boolean) {
    const today = new Date();
    let subDaysInt = 0;

    if (isTuesday(today)) {
      subDaysInt = 4;
    } else if (isFriday(today)) {
      subDaysInt = 3;
    } else {
      return;
    }

    const dataInicio = subDays(today, subDaysInt);
    const dataFim = subDays(today, 1);
    const consorcios = ['STPC', 'STPL', 'TEC'];
    await this.limparAgrupamentos(dataInicio, dataFim, consorcios);
    await this.geradorRemessaExec(dataInicio, dataFim, today,
      consorcios, HeaderName.MODAL, pagamentoUnico);
  }

  async limparAgrupamentos(dataInicio: Date, dataFim: Date, consorcios: string[]) {
    const ordensAgrupadas = await this.ordemPagamentoService.findOrdensAgrupadas(dataInicio, dataFim, consorcios);

    const idsAgrupamentos =
      ordensAgrupadas.map(f => f.ordemPagamentoAgrupadoId)
        .join("','");

    if (idsAgrupamentos && idsAgrupamentos.trim() != '') {
      //exclui historico
      await this.ordemPagamentoAgrupadoService.excluirHistorico(idsAgrupamentos);
      //atualizar ordens
      await this.ordemPagamentoService.removerAgrupamentos(consorcios, idsAgrupamentos);
      //excluir ordens agrupadas
      await this.ordemPagamentoAgrupadoService.excluirOrdensAgrupadas(idsAgrupamentos);
    }
  }

  async remessaConsorciosExec(pagamentoUnico?: boolean) {
    const today = new Date();
    let subDaysInt = 0;

    if (isTuesday(today)) {
      subDaysInt = 4;
    } else if (isFriday(today)) {
      subDaysInt = 3;
    } else {
      return;
    }

    const dataInicio = subDays(today, subDaysInt);
    const dataFim = subDays(today, 1);

    // await this.limparAgrupamentos(dataInicio, dataFim, CronJobsService.CONSORCIOS);
    await this.geradorRemessaExec(dataInicio, dataFim, today, CronJobsService.CONSORCIOS, HeaderName.CONSORCIO, pagamentoUnico);
  }

  async retornoExec() {
    let arq = true;
    while (arq) {
      const txt = await this.retornoService.lerRetornoSftp();
      if (txt) {
        try {
          await this.retornoService.salvarRetorno({ name: txt?.name, content: txt?.content });
        } catch (err) {
          console.log(err);
        }
      } else {
        arq = false;
      }
    }
  }

  async sincronizarEAgruparOrdensPagamento() {
    const METHOD = 'sincronizarEAgruparOrdensPagamento';
    this.logger.log('Tentando adquirir lock para execução da tarefa de sincronização e agrupamento.');
    const locked = await this.distributedLockService.acquireLock(METHOD);
    if (locked) {
      try {
        this.logger.log('Lock adquirido para a tarefa de sincronização e agrupamento.');

        // Sincroniza as ordens de pagamento para todos os modais e consorcios
        const today = new Date();
        let dataInicio = today
        let dataFim = today
        let dataPagamento = today;

        const dayOfWeek = today.getDay();

        // Verifica se é sexta-feira (5), sábado (6), domingo (0) ou segunda-feira (1)
        if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0 || dayOfWeek === 1) {
          //Se está entre sexta e segunda!  
          dataInicio = isFriday(today) ? today : this.getPreviousFriday(today);//data inicio sexta
          dataFim = nextMonday(today);//data fim segunda
          dataPagamento = nextTuesday(today);//data pagamento terça 
        } else {
          //Se está entre terça e quinta!  
          dataInicio = isTuesday(today) ? today : this.getPreviousTuesday(today); //data inicio terça
          dataFim = nextThursday(today); //data fim quinta
          dataPagamento = nextFriday(today);//data pagamento sexta
        }

        this.logger.log(`Iniciando sincronização das ordens de pagamento do BigQuery. Data de Início: ${dataInicio.toISOString()}, Data Fim: ${dataFim.toISOString()}`, METHOD);
        const consorciosEModais = [...CronJobsService.CONSORCIOS, ...CronJobsService.MODAIS];
        await this.ordemPagamentoService.sincronizarOrdensPagamento(dataInicio, dataFim, consorciosEModais);
        this.logger.log('Sincronização finalizada. Iniciando agrupamento para modais.', METHOD);
        const pagadorKey: keyof AllPagadorDict = 'contaBilhetagem';
        // Agrupa para os modais
        await this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupados(dataInicio, dataFim, dataPagamento, pagadorKey, CronJobsService.MODAIS);
        this.logger.log('Tarefa finalizada com sucesso.', METHOD);
      } catch (error) {
        this.logger.error(`Erro ao executar tarefa, abortando. - ${error}`, error?.stack, METHOD);
      } finally {
        await this.distributedLockService.releaseLock(METHOD);
      }
    } else {
      this.logger.log('Não foi possível adquirir o lock para a tarefa de sincronização e agrupamento.');
    }
  }

  async sincronizarTransacoesBq() {
    const METHOD = 'sincronizarTransacoesBq';
    this.logger.log('Tentando adquirir lock para execução da tarefa de sincronização das transações.');
    const locked = await this.distributedLockService.acquireLock(METHOD);
    if (locked) {
      try {
        this.logger.log('Lock adquirido para a tarefa de sincronização e agrupamento.');
        const today = startOfDay(new Date());

        await this.bigQueryTransacaoService.getAllTransacoes(today);

      } catch (error) {
        this.logger.error(`Erro ao executar tarefa, abortando. - ${error}`, error?.stack, METHOD);
      } finally {
        await this.distributedLockService.releaseLock(METHOD);
      }
    } else {
      this.logger.log('Não foi possível adquirir o lock para a tarefa de sincronização e agrupamento.');
    }
  }

  getNextThursday(date = new Date()) {
    if (isThursday(date)) {
      return new Date(date.toISOString().split('T')[0]);
    }
    return nextThursday(date);
  }

  getLastFriday(date = new Date()) {
    if (isFriday(date)) {
      return new Date(date.toISOString().split('T')[0]);
    }
    return previousFriday(date);
  }

  getNextFriday(date = new Date()) {
    return nextFriday(date);
  }

  getPreviousFriday(today: Date) {
    const dayOfWeek = today.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
    // Calcula quantos dias voltar até a última sexta-feira
    const daysSinceFriday = (dayOfWeek + 2) % 7 || 7;
    const previousFriday = new Date(today);
    previousFriday.setDate(today.getDate() - daysSinceFriday);
    return previousFriday;
  }

  getPreviousTuesday(today: Date) {
    const dayOfWeek = today.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
    // Calcula quantos dias voltar até a última terça-feira
    const daysSinceTuesday = (dayOfWeek + 5) % 7 || 7;
    const previousTuesday = new Date(today);
    previousTuesday.setDate(today.getDate() - daysSinceTuesday);
    return previousTuesday;
  }


  async fullBackup() {
    const METHOD = 'fullBackup';
    try {
      this.logger.log('Iniciando BACKUP selecionado do SFTP', METHOD);
      await this.sftpService.backupSelectedFoldersToGcs([
        '/backup/extrato/success/2026',
        '/backup/remessa/2026',
        '/backup/retorno/success/2026',
        '/enviados',
        '/retorno'
      ]);
      this.logger.log('BACKUP selecionado finalizado', METHOD);
    } catch (error) {
      this.logger.error(`Erro ao executar backup selecionado: ${error.message}`, error?.stack, METHOD);
    }
  }
}
