import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob, CronJobParameters } from 'cron';
import { HeaderName } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { RemessaService } from 'src/cnab/novo-remessa/service/remessa.service';
import { RetornoService } from 'src/cnab/novo-remessa/service/retorno.service';
import {
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
import { validateEmail } from 'validations-br';
import { OrdemPagamentoAgrupadoService } from '../cnab/novo-remessa/service/ordem-pagamento-agrupado.service';
import { AllPagadorDict } from '../cnab/interfaces/pagamento/all-pagador-dict.interface';
import { DistributedLockService } from '../cnab/novo-remessa/service/distributed-lock.service';
import { nextFriday, nextThursday, previousFriday, isFriday, isThursday } from 'date-fns';
import { BigqueryTransacaoService } from 'src/bigquery/services/bigquery-transacao.service';
import { AgendamentoPagamentoService } from 'src/agendamento/service/agendamento-pagamento.service';
import { AgendamentoPagamentoRemessaDTO } from 'src/agendamento/domain/dto/agendamento-pagamento-remessa.dto';
import { AgendamentoPagamentoDTO } from 'src/agendamento/domain/dto/agendamento-pagamento.dto';
import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';
import { DetalheAService } from 'src/cnab/service/pagamento/detalhe-a.service';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { AprovacaoPagamentoService } from 'src/agendamento/service/aprovacao-pagamento.service';
import { AprovacaoEnum } from 'src/agendamento/enums/aprovacao.enum';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { AprovacaoPagamentoDTO } from 'src/agendamento/domain/dto/aprovacao-pagamento.dto';
import { TipoBeneficarioEnum } from 'src/agendamento/enums/tipo-beneficiario.enum';


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
  automacao = 'automacao'
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
    private ordemPagamentoService: OrdemPagamentoService,
    private bigQueryTransacaoService: BigqueryTransacaoService,
    private distributedLockService: DistributedLockService,
    private agendamentoPagamentoService: AgendamentoPagamentoService,
    private aprovacaoService: AprovacaoPagamentoService,
    private detalheAService: DetalheAService
  ) { }

  async onModuleInit() {
    await this.sincronizarEAgruparOrdensPagamento();
    this.onModuleLoad().catch((error: Error) => {
      throw error;
    });
  }

  async onModuleLoad() {

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
    );

    this.jobsConfig.push(...await this.geraCronJob());

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
    consorcios: string[], rem: AgendamentoPagamentoRemessaDTO) {

    // Agrupa pagamentos     
    const headerName = rem.tipoBeneficiario == "Consorcio" ? HeaderName.CONSORCIO : HeaderName.MODAL
    for (let index = 0; index < consorcios.length; index++) {
      await this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupados(dataInicio,
        dataFim, dataPagamento, rem.pagador, [consorcios[index]]);
    }

    //Prepara o remessa
    const headerArquivo = await this.remessaService.prepararRemessa(dataInicio, dataFim, dataPagamento, consorcios);

    let pagamentoAprovado = false;

    if (rem.aprovacao) {//se estiver marcado que necessita de aprovação
      pagamentoAprovado = await this.verificarAprovacao(rem, headerArquivo) //atualizar o detalhe_a e valor gerado
    }

    if (rem.aprovacao == null || rem.aprovacao == false || pagamentoAprovado) {//Se não precisar de aprovação ou tiver aprovado na tabela de
      //Gera o TXT
      const txt = await this.remessaService.gerarCnabText(headerName);
      //Envia para o SFTP
      await this.remessaService.enviarRemessa(txt, headerName);
    }
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

  // async remessaModalExec(pagamentoUnico?: boolean) {
  //   const today = new Date();
  //   let subDaysInt = 0;

  //   if (isTuesday(today)) {
  //     subDaysInt = 4;
  //   } else if (isFriday(today)) {
  //     subDaysInt = 3;
  //   } else {
  //     return;
  //   }

  //   const dataInicio = subDays(today, subDaysInt);
  //   const dataFim = subDays(today, 1);
  //   const consorcios = ['STPC', 'STPL', 'TEC'];
  //   await this.limparAgrupamentos(dataInicio, dataFim, consorcios);
  //   await this.geradorRemessaExec(dataInicio, dataFim, today,
  //     consorcios, HeaderName.MODAL, pagamentoUnico);
  // }

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

  async remessaAutomacaoExec(rem: AgendamentoPagamentoRemessaDTO) {
    this.logger.log('INICIO AUTOMAÇÃO');

    const today = new Date();
    const dataInicio = this.getData(today.getDay() + 1, rem.diaInicioPagar);
    const dataFim = this.getData(today.getDay() + 1, rem.diaFinalPagar);

    const beneficiarios = rem.beneficiarios.flatMap(b => b.fullName ? [b.fullName] : [])
    await this.limparAgrupamentos(dataInicio, dataFim, beneficiarios);
    await this.geradorRemessaExec(dataInicio, dataFim, today, beneficiarios, rem);
    this.logger.log('TERMINO AUTOMAÇÃO');
  }

  getData(today: number, data: number): Date {
    let diferenca = 0
    if (data > today) {
      diferenca = data - today;
    } else {
      diferenca = today - data;
    }
    return subDays(new Date(), diferenca);
  }

  async retornoExec() {
    // let arq = true;
    // while (arq) {
    //   const txt = await this.retornoService.lerRetornoSftp();
    //   if (txt) {
    //     try {
    //       await this.retornoService.salvarRetorno({ name: txt?.name, content: txt?.content });
    //     } catch (err) {
    //       console.log(err);
    //     }
    //   } else {
    //     arq = false;
    //   }
    // }
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
        const pagador = await this.ordemPagamentoAgrupadoService.getPagador(pagadorKey)
        // Agrupa para os modais
        await this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupados(dataInicio, dataFim, dataPagamento, pagador, CronJobsService.MODAIS);
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

  async geraCronJob(): Promise<ICronJob[]> {
    const cronsAutonomos: ICronJob[] = []

    const agendamentos = await this.agendamentoPagamentoService.findAll();

    let listaRemessas: AgendamentoPagamentoRemessaDTO[] = [];

    for (const agenda of agendamentos) {
      if (agenda.status) {
        if ((this.verificaDiaSemana(agenda.diaSemana))
          || (agenda.diaIntervalo != null && this.verificarIntervalo(agenda.diaIntervalo, agenda.createdAt))) { // verifica se o agendamento esta ativo e se é do dia atual 
          if (agenda.beneficiarioUsuario) {
            const tipo = agenda.tipoBeneficiario; // Consorcio, Modal ou Individual
            // Procura a remessa existente
            let remessaExistente = listaRemessas.find(r => r.tipoBeneficiario === tipo);
            // Se não existe, cria e adiciona na lista
            if (!remessaExistente) {
              const novaRemessa = new AgendamentoPagamentoRemessaDTO();
              this.instanciaRemessa(novaRemessa, agenda);
              listaRemessas.push(novaRemessa);
              remessaExistente = novaRemessa;
            } else {
              // Agora já garantimos que existe, então adiciona o beneficiário
              remessaExistente.beneficiarios.push(agenda.beneficiarioUsuario);
            }
          }
        }
      }
    }

    /**                   
      * CRON JOB AUTONOMO
      */
    for (const rem of listaRemessas) {
      cronsAutonomos.push({
        name: `${CronJobsEnum.automacao}_${rem.tipoBeneficiario}_${rem.horario}`,
        cronJobParameters: {
          cronTime: this.getHorarioFormatado(this.remHours(rem.horario, 0)),
          onTick: async () => {
            await this.remessaAutomacaoExec(rem);
          },
          timeZone: 'America/Sao_Paulo'
        }
      })
    }
    return cronsAutonomos;
  }

  remHours(time, hoursToAdd) {
    const [h, m, s] = time.split(":").map(Number);

    const date = new Date();
    date.setHours(h, m, s);
    date.setHours(date.getHours() - hoursToAdd);

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");

    return `${hh}:${mm}:${ss}`;
  }


  instanciaRemessa(remessa: AgendamentoPagamentoRemessaDTO, agenda: AgendamentoPagamentoDTO) {
    remessa.aprovacao = agenda.aprovacao;
    if (agenda.beneficiarioUsuario != null) {
      remessa.beneficiarios.push(agenda.beneficiarioUsuario);
    }
    remessa.diaIntervalo = agenda.diaIntervalo;
    remessa.diaInicioPagar = agenda.diaInicioPagar;
    remessa.diaFinalPagar = agenda.diaFinalPagar;
    remessa.pagador = agenda.pagador;
    remessa.tipoBeneficiario = agenda.tipoBeneficiario;
    remessa.horario = agenda.horario;
  }


  getHorarioFormatado(time) {
    // Aceita "HH:mm" ou "HH:mm:ss"
    const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);

    if (!match) {
      throw new Error("Formato inválido. Use HH:mm ou HH:mm:ss");
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    // Cron no formato: minuto hora dia-do-mês mês dia-da-semana
    // Ex: "30 13 * * *"
    return `${minutes} ${hours} * * *`;
  }


  verificaDiaSemana(dia) {
    return (new Date().getDay() + 1) === Number(dia);
  }

  verificarIntervalo(diaIntervalo: number, createdAt: Date) {
    let data = new Date(createdAt);
    const hoje = new Date();

    while (data <= hoje) {
      const nova = new Date(data);
      nova.setDate(data.getDate() + diaIntervalo);
      if (nova > hoje)
        return data;
      // o ciclo válido é o anterior
      data = nova;
    }

    return (
      data.getDate() === hoje.getDate() &&
      data.getMonth() === hoje.getMonth() &&
      data.getFullYear() === hoje.getFullYear()
    );
  }

  async verificarAprovacao(rem: AgendamentoPagamentoRemessaDTO, headerArquivo: HeaderArquivo): Promise<boolean> {
    if (rem.aprovacaoPagamento?.id) {
      const aprovacao = await this.aprovacaoService.findById(rem.aprovacaoPagamento.id);

      if (aprovacao) {
        let detalhesA: DetalheA[] = [];
        for (const headerLote of headerArquivo.headersLote) {
          detalhesA.push(... await this.detalheAService.getDetalheAHeaderLote(headerLote.id));
        }

        if (aprovacao.status === AprovacaoEnum.Aprovado) {
          this.verificarValoresAprovados(detalhesA, rem.beneficiarios, aprovacao);//Se o pagamento estiver aprovado atualiza os valores de lancamento no detalhe_A
          return true;
        } else {
          this.atualizarValorGeradoBQ(detalhesA, rem.beneficiarios, aprovacao);
        }
      }
    }
    return false;
  }

  async verificarValoresAprovados(detalhesA: DetalheA[], beneficiarios: CreateUserDto[], aprovacao: AprovacaoPagamentoDTO) {
    for (const detalheA of detalhesA) {
      for (const beneficiario of beneficiarios) {
        if (await this.verificaBeneficiarioPagamento(beneficiario, detalheA)) {
          detalheA.valorLancamento = aprovacao.valorAprovado;
          detalheA.valorRealEfetivado = aprovacao.valorAprovado;
          await this.detalheAService.saveEntity(detalheA);   //Atualiza valor aprovado no detalhe A     
        }
      }
    }
  }

  async atualizarValorGeradoBQ(detalhesA: DetalheA[], beneficiarios: CreateUserDto[], aprovacao: AprovacaoPagamentoDTO) {
    for (const detalheA of detalhesA) {
      for (const beneficiario of beneficiarios) {
        if (await this.verificaBeneficiarioPagamento(beneficiario, detalheA)) {
          aprovacao.valorGerado = detalheA.valorLancamento;
          aprovacao.detalheA.id = detalheA.id;
          aprovacao.status = AprovacaoEnum.AguardandoAprovacao;
          this.aprovacaoService.save(aprovacao); // atualiza a aprovação com valor gerado e o detalhe A
        }
      }
    }
  }

  async verificaBeneficiarioPagamento(beneficiario: CreateUserDto, detalheA: DetalheA) {
    const res = await this.detalheAService.existsDetalheABeneficiario(detalheA.id, beneficiario.permitCode ? beneficiario.permitCode : "");
    if (res.length > 0) {
      return true;
    }
    return false;
  }
}