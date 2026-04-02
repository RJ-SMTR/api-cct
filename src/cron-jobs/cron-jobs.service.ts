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
    await this.remessaPendenteExec('2026-01-01','2026-04-02','2026-04-02',[     
'47', '51', '55', '56', '59', '60', '63', '67', '70', '82', '83', '88', '89', '95', '99', '104', '105', '106', '114', '118',
 '129', '131', '133', '140', '141', '145', '147', '148', '149', '150', '155', '156', '158', '159', '165', '166', 
 '168', '171', '172', '178', '179', '193', '195', '197', '198', '201', '203', '206', '207', '209', '220', '222', '224', '227', '228', '229', '232', '233', '247', '248', '251', '261', '265', '266', '270', '272', '280', '283', '286', '288', '292', '295', '297', '307', '313', '320', '325', '327', '332', '335', '343', '346', '351', '353', '365', '370', '371', '372', '376', '377', '378', '379', '382', '383', '388', '398', '399', '410', '419', '420', '423', '424', '425', '430', '437', '441', '443', '444', '449', '450', '451', '454', '476', '480', '484', '485', '492', '501', '503', '513', '515', '517', '518', '522', '525', '529', '531', '537', '538', '548', '549', '563', '564', '567', '569', '570', '574', '575', '580', '588', '589', '592', '599', '601', '602', '603', '604', '606', '608', '611', '615', '616', '619', '620', '621', '628', '630', '633', '637', '641', '646', '650', '653', '655', '661', '663', '666', '667', '669', '677', '679', '680', '681', '682', '686', '688', '689', '693', '697', '700', '701', '702', '703', '708', '715', '716', '717', '718', '720', '721', '723', '727', '734', '736', '740', '748', '753', '757', '760', '769', '782', '786', '787', '790', '794', '805', '810', '812', '815', '816', '821', '822', '823', '826', '829', '837', '842', '843', '845', '847', '849', '852', '857', '859', '860', '862', '865', '867', '868', '870', '871', '874', '876', '882', '892', '897', '899', '902', '905', '907', '911', '919', '922', '927', '928', '930', '932', '943', '946', '947', '949', '952', '953', '955', '956', '957', '962', '963', '965', '968', '970', '972', '973', '977', '979', '981', '985', '986', '988', '989', '994', '996', '997', '1001', '1002', '1004', '1006', '1010', '1011', '1012', '1018', '1019', '1021', '1035', '1037', '1039', '1040', '1043', '1048', '1049', '1054', '1055', '1056', '1057', '1058', '1059', '1064', '1065', '1072', '1073', '1074', '1076', '1077', '1087', '1089', '1097', '1098', '1102', '1105', '1109', '1113', '1114', '1119', '1120', '1124', '1125', '1127', '1129', '1131', '1132', '1133', '1136', '1138', '1140', '1146', '1148', '1149', '1151', '1152', '1153', '1154', '1158', '1162', '1165', '1171', '1174', '1177', '1179', '1180', '1181', '1182', '1183', '1185', '1186', '1187', '1191', '1194', '1195', '1199', '1206', '1207', '1221', '1225', '1230', '1233', '1238', '1239', '1240', '1243', '1244', '1245', '1246', '1248', '1254', '1255', '1256', '1260', '1261', '1263', '1265', '1270', '1271', '1272', '1275', '1277', '1279', '1280', '1283', '1284', '1286', '1288', '1289', '1291', '1292', '1293', '1299', '1300', '1301', '1304', '1306', '1307', '1311', '1312', '1320', '1323', '1328', '1330', '1331', '1332', '1333', '1334', '1337', '1342', '1343', '1344', '1345', '1347', '1348', '1351', '1358', '1360', '1362', '1369', '1371', '1372', '1378', '1379', '1380', '1381', '1382', '1385', '1386', '1387', '1389', '1391', '1393', '1395', '1397', '1399', '1400', '1403', '1406', '1407', '1414', '1416', '1417', '1418', '1421', '1424', '1427', '1436', '1439', '1440', '1443', '1444', '1447', '1448', '1456', '1458', '1465', '1466', '1469', '1471', '1474', '1478', '1479', '1484', '1486', '1488', '1489', '1490', '1496', '1497', '1498', '1499', '1500', '1502', '1508', '1509', '1513', '1514', '1515', '1516', '1517', '1519', '1523', '1524', '1526', '1528', '1531', '1532', '1535', '1536', '1538', '1539', '1540', '1543', '1549', '1551', '1553', '1555', '1557', '1558', '1560', '1561', '1563', '1565', '1566', '1571', '1572', '1576', '1581', '1585', '1586', '1589', '1592', '1593', '1598', '1604', '1606', '1608', '1611', '1612', '1616', '1617', '1619', '1621', '1622', '1623', '1631', '1633', '1634', '1635', '1639', '1641', '1643', '1644', '1645', '1646', '1652', '1653', '1654', '1657', '1661', '1662', '1663', '1665', '1669', '1670', '1671', '1675', '1681', '1683', '1694', '1695', '1696', '1697', '1698', '1700', '1703', '1708', '1710', '1712', '1714', '1715', '1720', '1729', '1730', '1731', '1733', '1735', '1736', '1737', '1738', '1745', '1747', '1748', '1749', '1750', '1753', '1758', '1759', '1760', '1762', '1766', '1768', '1770', '1771', '1772', '1779', '1783', '1784', '1787', '1788', '1789', '1790', '1791', '1792', '1793', '1795', '1796', '1797', '1798', '1800', '1803', '1804', '1805', '1806', '1808', '1809', '1811', '1812', '1813', '1815', '1816', '1817', '1818', '1819', '1820', '1821', '1822', '1824', '1825', '1827', '1829', '1831', '1832', '1833', '1834', '1835', '1836', '1837', '1838', '1839', '1842', '1843', '1844', '1845', '1846', '1848', '1849', '1851', '1854', '1855', '1856', '1857', '1859', '1860', '1861', '1862', '1863', '1865', '1866', '1867', '1868', '1874', '1877', '1878', '1882', '1885', '1888', '1890', '1891', '1892', '1898', '1900', '1903', '1904', '1905', '1908', '1913', '1914', '1915', '1916', '1917', '1925', '1926', '1927', '1928', '1932', '1935', '1936', '1937', '1938', '1943', '1945', '1948', '1950', '1951', '1952', '1953', '1956', '1964', '1967', '1970', '1973', '1975', '1977', '1979', '1980', '1981', '1985', '1990', '1991', '1992', '1994', '1995', '1996', '1998', '1999', '2000', '2004', '2007', '2008', '2010', '2012', '2013', '2015', '2018', '2019', '2021', '2024', '2027', '2028', '2029', '2032', '2034', '2035', '2039', '2040', '2042', '2043', '2044', '2053', '2055', '2076', '2083', '2089', '2107', '2119', '2125', '2128', '2135', '2189', '2290', '2292', '2295', '2296', '2297',
 '2298', '2299', '2301', '2302', '2303', '2307', '2308', '2309', '2310', '2327', '2329', '2332'])


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
