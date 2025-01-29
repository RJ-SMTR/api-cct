import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob, CronJobParameters } from 'cron';
import { HeaderName } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { RemessaService } from 'src/cnab/novo-remessa/service/remessa.service';
import { RetornoService } from 'src/cnab/novo-remessa/service/retorno.service';

import {
  addDays,
  endOfDay,
  isFriday,
  isMonday,
  isSaturday,
  isSunday,
  isThursday,
  isTuesday,
  isWithinInterval,
  startOfDay,
  subDays,
} from 'date-fns';
import { CnabService, ICnabInfo } from 'src/cnab/cnab.service';
import { PagadorContaEnum } from 'src/cnab/enums/pagamento/pagador.enum';
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
import { formatDateISODate } from 'src/utils/date-utils';
import { validateEmail } from 'validations-br';
import { OrdemPagamentoAgrupadoService } from '../cnab/novo-remessa/service/ordem-pagamento-agrupado.service';
import { AllPagadorDict } from '../cnab/interfaces/pagamento/all-pagador-dict.interface';
import { DistributedLockService } from '../cnab/novo-remessa/service/distributed-lock.service';

/**
 * Enum CronJobServicesJobs
 */
export enum CronJobsEnum {
  bulkSendInvites = 'bulkSendInvites',
  sendReport = 'sendReport',
  pollDb = 'pollDb',
  bulkResendInvites = 'bulkResendInvites',
  updateRetorno = 'updateRetorno',
  generateRemessaVLT = 'generateRemessaVLT',
  generateRemessaEmpresa = 'generateRemessaEmpresa',
  generateRemessaVanzeiros = 'generateRemessaVanzeiros',
  generateRemessaLancamento = 'generateRemessaLancamento',
  sincronizarEAgruparOrdensPagamento = 'sincronizarEAgruparOrdensPagamento'
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
  private static readonly CONSORCIOS = ['VLT', 'Intersul', 'Transcarioca', 'Internorte', 'MobiRio', 'Santa Cruz'];

  constructor(
    private configService: ConfigService, //
    private settingsService: SettingsService,
    private schedulerRegistry: SchedulerRegistry,
    private mailService: MailService,
    private mailHistoryService: MailHistoryService,
    private usersService: UsersService,
    private cnabService: CnabService,
    private ordemPagamentoAgrupadoService: OrdemPagamentoAgrupadoService,
    private remessaService: RemessaService,
    private retornoService: RetornoService,
    private ordemPagamentoService: OrdemPagamentoService,
    private distributedLockService: DistributedLockService,
  ) { }


  onModuleInit() {
    this.onModuleLoad().catch((error: Error) => {
      throw error;
    });
  }

  async onModuleLoad() {
    //CHAMADAS PARA TESTE
    //await this.remessaVLTExec();
    //await this.remessaModalExec();
    //await this.remessaConsorciosExec();

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
          cronTime: '0 11 * * *', // Every day, 11:00 GMT = 08:00 BRT (GMT-3)
          onTick: async () => {
            const today = new Date();
            if (isSaturday(today) || isSunday(today)) {
              return;
            }
            await this.remessaVLTExec();
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
          cronTime: '0 16 * * THU', // Rodar todas as quintas 16:00 GMT = 13:00 BRT (GMT-3)
          onTick: async () => {
            await this.remessaModalExec();
          },
        },
      },
      {
        /**
         * Gerar arquivo Remessa dos Consórcios - toda 5a, 13:00, duração: 15 min
         *
         * Gerar remessa consórcios
         */
        name: CronJobsEnum.generateRemessaEmpresa,
        cronJobParameters: {
          cronTime: '0 13 * * THU', // Rodar todas as quintas 13:00 GMT = 10:00 BRT (GMT-3)
          onTick: async () => {
            await this.remessaConsorciosExec();
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
         * Todos os dias, a cada duas horas
         * */
        name: CronJobsEnum.sincronizarEAgruparOrdensPagamento,
        cronJobParameters: {
          // duas em duas horas depois das 6h
          cronTime: "0 6-22/2 * * *",
          onTick: async () => await this.sincronizarEAgruparOrdensPagamento(),
        },
      },
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
      this.logger.log('Iniciando tarefa.', METHOD);

      const isEnabledFlag = await this.settingsService.findOneBySettingData(appSettings.any__mail_report_enabled);
      if (!isEnabledFlag) {
        this.logger.error(`Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' ` + 'não foi encontrado no banco.', undefined, METHOD);
        return;
      } else if (isEnabledFlag.getValueAsBoolean() === false) {
        this.logger.log(`Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' = 'false'.` + ` Para ativar, altere na tabela 'setting'`, METHOD);
        return;
      }

      if (!isEnabledFlag) {
        this.logger.error(`Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' ` + 'não foi encontrado no banco.', undefined, METHOD);
        return;
      } else if (isEnabledFlag.getValueAsBoolean() === false) {
        this.logger.log(`Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' = 'false'.` + ` Para ativar, altere na tabela 'setting'`, METHOD);
        return;
      }

      const mailRecipients = await this.settingsService.findManyBySettingDataGroup(appSettings.any__mail_report_recipient);

      if (!mailRecipients) {
        this.logger.error(`Tarefa cancelada pois a configuração 'mail.statusReportRecipients'` + ` não foi encontrada (retornou: ${mailRecipients}).`, undefined, METHOD);
        return;
      } else if (mailRecipients.some((i) => !validateEmail(i.getValueAsString()))) {
        this.logger.error(`Tarefa cancelada pois a configuração 'mail.statusReportRecipients'` + ` não contém uma lista de emails válidos. Retornou: ${mailRecipients}.`, undefined, METHOD);
        return;
      }

      // Send mail
      const emails = mailRecipients.reduce((l: string[], i) => [...l, i.getValueAsString()], []);
      try {
        const mailSentInfo = await this.mailService.sendStatusReport({
          to: emails,
          data: {
            statusCount: await this.mailHistoryService.getStatusCount(),
          },
        } as any);

        // Success
        if (mailSentInfo.success === true) {
          this.logger.log(`Relatório enviado com sucesso para os emails ${emails}`, METHOD);
        }

        // SMTP error
        else {
          this.logger.error(`Relatório enviado para os emails ${emails} retornou erro. - ` + `mailSentInfo: ${JSON.stringify(mailSentInfo)}`, new Error().stack, METHOD);
        }

        // API error
      } catch (httpException) {
        this.logger.error(`Email falhou ao enviar para ${emails}`, httpException?.stack, METHOD);
      }
      this.logger.log('Tarefa finalizada.', METHOD);
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
    consorcios: string[], headerName: HeaderName) {
    //Agrupa pagamentos     

    for (let index = 0; index < consorcios.length; index++) {
      await this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupados(dataInicio,
        dataFim, dataPagamento, "contaBilhetagem", [consorcios[index]]);
    }
    //Prepara o remessa
    await this.remessaService.prepararRemessa(dataInicio, dataFim, consorcios);
    //Gera o TXT
    const txt = await this.remessaService.gerarCnabText(headerName);
    //Envia para o SFTP
    await this.remessaService.enviarRemessa(txt);
  }

  async remessaVLTExec() {
    //Rodar de segunda a sexta   
    const today = new Date();
    /** defaut: qua,qui,sex,sáb,dom */
    let daysBeforeBegin = 1;
    let daysBeforeEnd = 1;
    if (isMonday(today)) {
      daysBeforeBegin = 3;
      daysBeforeEnd = 3;
    } else if (isTuesday(today)) {
      daysBeforeBegin = 3;
    }
    const dataInicio = subDays(today, daysBeforeBegin);
    const dataFim = subDays(today, daysBeforeEnd);
    await this.geradorRemessaExec(dataInicio, dataFim, today,
      ['VLT'], HeaderName.VLT);
  }

  async remessaModalExec() {
    //Rodar Quinta 
    const today = new Date();
    const dataInicio = new Date('2025-01-03')  // subDays(today, 6);
    const dataFim = new Date('2025-01-09') //subDays(today, 0); 
    await this.geradorRemessaExec(dataInicio, dataFim, today   /*addDays(today,1)*/,
      ['STPC', 'STPL', 'TEC'], HeaderName.MODAL);
  }

  async remessaConsorciosExec() {
    //Rodar na Quinta
    const today = new Date();
    const dataInicio = new Date('2025-01-17')  // subDays(today, 6);
    const dataFim = new Date('2025-01-23') //subDays(today, 0); 
    await this.geradorRemessaExec(dataInicio, dataFim, today /*addDays(today,1)*/,
      ['Internorte', 'Intersul', 'MobiRio', 'Santa Cruz', 'Transcarioca'], HeaderName.CONSORCIO);
  }

  async retornoExec() {
    const txt = await this.retornoService.lerRetornoSftp();
    if (txt)
      await this.retornoService.salvarRetorno({ name: txt?.name, content: txt?.content });
  }


  async sincronizarEAgruparOrdensPagamento() {
    const METHOD = 'sincronizarEAgruparOrdensPagamento';
    this.logger.log('Tentando adquirir lock para execução da tarefa de sincronização e agrupamento.');
    const locked = await this.distributedLockService.acquireLock(METHOD);
    if (locked) {
      try {
        this.logger.log('Lock adquirido para a tarefa de sincronização e agrupamento.');
        // Sincroniza as ordens de pagamento para todos os modais e consorcios
        const nextThursday = this.getNextThursday();
        const lastFriday = this.getLastFriday();
        const nextFriday = this.getNextFriday();
        this.logger.log(`Iniciando sincronização das ordens de pagamento do BigQuery. Data de Início: ${lastFriday.toISOString()}, Data Fim: ${nextThursday.toISOString()}`, METHOD);
        const consorciosEModais = [...CronJobsService.CONSORCIOS, ...CronJobsService.MODAIS];
        await this.ordemPagamentoService.sincronizarOrdensPagamento(lastFriday, nextThursday, consorciosEModais);
        this.logger.log('Sincronização finalizada. Iniciando agrupamento para modais.', METHOD);
        const pagadorKey: keyof AllPagadorDict = 'contaBilhetagem';
        // Agrupa para os modais
        await this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupados(lastFriday, nextThursday, nextFriday, pagadorKey, CronJobsService.MODAIS);
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

  getNextThursday(date = new Date()) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 4) {
      return new Date(date.toISOString().split('T')[0]);
    }
    const daysUntilNextThursday = (4 - dayOfWeek + 7) % 7 || 7;
    const nextThursday = new Date(date);
    nextThursday.setDate(date.getDate() + daysUntilNextThursday);
    return new Date(nextThursday.toISOString().split('T')[0]);
  }

  getLastFriday(date = new Date()) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 5) {
      return new Date(date.toISOString().split('T')[0]);
    }
    const daysSinceLastFriday = ((dayOfWeek + 2) % 7) + 1;
    const lastFriday = new Date(date);
    lastFriday.setDate(date.getDate() - daysSinceLastFriday);
    return new Date(lastFriday.toISOString().split('T')[0]);
  }

  getNextFriday(date = new Date()) {
    const dayOfWeek = date.getDay();
    const daysUntilNextFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const nextFriday = new Date(date);
    nextFriday.setDate(date.getDate() + daysUntilNextFriday);
    return new Date(nextFriday.toISOString().split('T')[0]);
  }

}
