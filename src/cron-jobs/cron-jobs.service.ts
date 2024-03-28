import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob, CronJobParameters } from 'cron';
import { CnabService } from 'src/cnab/service/cnab.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { MailService } from 'src/mail/mail.service';
import { appSettings } from 'src/settings/app.settings';
import { SettingEntity } from 'src/settings/entities/setting.entity';
import { ISettingData } from 'src/settings/interfaces/setting-data.interface';
import { SettingsService } from 'src/settings/settings.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { OnModuleLoad } from 'src/utils/interfaces/on-load.interface';
import { logError, logLog } from 'src/utils/log-utils';
import { validateEmail } from 'validations-br';

/**
 * Enum CronJobServicesJobs
 */
export enum CrobJobsEnum {
  bulkSendInvites = 'bulkSendInvites',
  sendStatusReport = 'sendStatusReport',
  pollDb = 'pollDb',
  bulkResendInvites = 'bulkResendInvites',
  updateTransacao1 = 'updateTransacaoWeek1',
  updateTransacao2 = 'updateTransacaoWeek2',
  updateRemessaJae = 'updateRemessaJae',
  updateRemessaOutros = 'updateRemessaOutros',
  updateRetorno = 'updateRetorno',
  updateExtrato = 'updateExtrato',
}

interface ICronJob {
  name: string;
  cronJobParameters: CronJobParameters;
}

interface ICronJobSetting {
  setting: ISettingData;
  cronJob: CrobJobsEnum;
  isEnabledFlag?: ISettingData;
}

@Injectable()
export class CronJobsService implements OnModuleInit, OnModuleLoad {
  private logger = new Logger('CronJobsService', { timestamp: true });

  public jobsConfig: ICronJob[] = [];
  public staticJobs = {
    updateTransacao2: {
      name: CrobJobsEnum.updateTransacao2,
      cronJobParameters: {
        cronTime: '30 6 * * *',  // 03:30 BRT = 06:30 UTC
        onTick: async () => {
          await this.updateTransacao2();
        },
      },
    } as ICronJob,
  };

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    private schedulerRegistry: SchedulerRegistry,
    private mailService: MailService,
    private mailHistoryService: MailHistoryService,
    private usersService: UsersService,
    private cnabService: CnabService,
  ) { }

  onModuleInit() {
    this.onModuleLoad().catch((error: Error) => { throw error; });
  }

  async onModuleLoad() {
    const THIS_CLASS_WITH_METHOD = 'CronJobsService.onModuleLoad()';
    await this.updateTransacao1();
    await this.updateRemessa();
    this.jobsConfig.push(
      {
        name: CrobJobsEnum.bulkSendInvites,
        cronJobParameters: {
          cronTime: (
            await this.settingsService.getOneBySettingData(
              appSettings.any__mail_invite_cronjob,
              true,
              THIS_CLASS_WITH_METHOD,
            )
          ).getValueAsString(),
          onTick: async () => this.bulkSendInvites(),
        },
      },
      {
        name: CrobJobsEnum.sendStatusReport,
        cronJobParameters: {
          cronTime: (
            await this.settingsService.getOneBySettingData(
              appSettings.any__mail_report_cronjob,
              true,
              THIS_CLASS_WITH_METHOD,
            )
          ).getValueAsString(),
          onTick: () => this.sendStatusReport(),
        },
      },
      {
        name: CrobJobsEnum.pollDb,
        cronJobParameters: {
          cronTime: (
            await this.settingsService.getOneBySettingData(
              appSettings.any__poll_db_cronjob,
              true,
              THIS_CLASS_WITH_METHOD,
            )
          ).getValueAsString(),
          onTick: () => this.pollDb(),
        },
      },
      {
        name: CrobJobsEnum.bulkResendInvites,
        cronJobParameters: {
          cronTime: '45 14 15 * *', // Day 15, 14:45 GMT = 11:45 BRT (GMT-3)
          onTick: async () => {
            await this.bulkResendInvites();
          },
        },
      },
      // {
      //   name: CrobJobsEnum.updateTransacao1,
      //   cronJobParameters: {
      //     cronTime: '30 4 * * *',  // 00:30 BRT = 03:30 GMT
      //     onTick: async () => {
      //       await this.updateTransacao1();
      //     },
      //   },
      // },
      // {
      //   name: CrobJobsEnum.updateRemessaJae,
      //   cronJobParameters: {
      //     cronTime: '30 0 * * 5',  // Every friday
      //     onTick: async () => {
      //       await this.updateRemessa();
      //     },
      //   },
      // },
      {
        name: CrobJobsEnum.updateRetorno,
        cronJobParameters: {
          cronTime: '0 */6 * * *', // Every 6h GMT (3h BRT)
          onTick: async () => {
            await this.updateRetorno();
          },
        },
      },
      {
        name: CrobJobsEnum.updateExtrato,
        cronJobParameters: {
          cronTime: '0 */6 * * *', // Every 6h GMT (3h BRT)
          onTick: async () => {
            await this.updateExtrato();
          },
        },
      }
    );

    for (const jobConfig of this.jobsConfig) {
      this.startCron(jobConfig);
      this.logger.log(
        `Tarefa agendada: ${jobConfig.name}, ${jobConfig.cronJobParameters.cronTime}`,
      );
    }
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
    const THIS_METHOD = `${this.bulkSendInvites.name}()`;
    const THIS_CLASS_AND_METHOD = `${CronJobsService}.${this.bulkSendInvites.name}()`;
    const activateAutoSendInvite =
      await this.settingsService.findOneBySettingData(
        appSettings.any__activate_auto_send_invite,
      );
    if (!activateAutoSendInvite) {
      logLog(this.logger,
        `Tarefa cancelada pois 'setting.${appSettings.any__activate_auto_send_invite.name}' não foi encontrado no banco.`,
        THIS_METHOD);
      return;
    } else if (activateAutoSendInvite.getValueAsBoolean() === false) {
      logLog(this.logger,
        `Tarefa cancelada pois 'setting.${appSettings.any__activate_auto_send_invite.name}' = 'false'.` +
        ` Para ativar, altere na tabela 'setting'`,
        THIS_METHOD);
      return;
    }

    // get data
    const sentToday = (await this.mailHistoryService.findSentToday()) || [];
    const unsent = (await this.mailHistoryService.findUnsent()) || [];
    const remainingQuota = await this.mailHistoryService.getRemainingQuota();
    const dailyQuota = () => this.configService.getOrThrow('mail.dailyQuota');

    logLog(this.logger,
      `Iniciando tarefa - a enviar: ${unsent.length},` +
      ` enviado: ${sentToday.length}/${dailyQuota()},` +
      ` falta enviar: ${remainingQuota}`,
      THIS_METHOD,
    );

    for (let i = 0; i < remainingQuota && i < unsent.length; i++) {
      const invite = new MailHistory(unsent[i]);

      const user = await this.usersService.findOne({ id: invite.user.id });

      // User mail error
      if (!user?.email) {
        logError(this.logger,
          `Usuário não tem email válido (${user?.email}), este email não será enviado.`,
          THIS_METHOD);
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
          THIS_CLASS_AND_METHOD,
        );
        continue;
      }

      // Send mail
      try {
        const { mailSentInfo } =
          await this.mailService.sendConcludeRegistration({
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
            THIS_CLASS_AND_METHOD,
          );
          logLog(this.logger, 'Email enviado com sucesso.', THIS_METHOD);
        }

        // SMTP error
        else {
          logError(this.logger,
            'Email enviado retornou erro.',
            THIS_METHOD,
            mailSentInfo,
            new Error(),
          );
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
            THIS_CLASS_AND_METHOD,
          );
        }

        // API error
      } catch (httpException) {
        logError(this.logger,
          'Email falhou ao enviar.',
          THIS_METHOD,
          httpException,
          httpException as Error,
        );
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
          THIS_CLASS_AND_METHOD,
        );
      }
    }
    if (unsent.length == 0 || remainingQuota == 0) {
      const reasons: string[] = [
        ...(unsent.length == 0 ? ['no mails to sent'] : []),
        ...(remainingQuota == 0 ? ['no remaining quota'] : []),
      ];
      logLog(this.logger, `Tarefa cancelada pois ${reasons.join(' e ')}`, THIS_METHOD);
    } else {
      logLog(this.logger, 'Tarefa finalizada com sucesso.', THIS_METHOD);
    }
  }

  async sendStatusReport() {
    logLog(this.logger, 'Iniciando tarefa.', 'sendStatusReport()');
    const THIS_METHOD = `${this.sendStatusReport.name}()`;

    const isEnabledFlag = await this.settingsService.findOneBySettingData(
      appSettings.any__mail_report_enabled,
    );
    if (!isEnabledFlag) {
      logError(this.logger,
        `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' não foi encontrado no banco.`,
        THIS_METHOD);
      return;
    } else if (isEnabledFlag.getValueAsBoolean() === false) {
      logLog(this.logger,
        `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' = 'false'.` +
        ` Para ativar, altere na tabela 'setting'`,
        THIS_METHOD);
      return;
    }

    if (!isEnabledFlag) {
      logError(this.logger,
        `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' não foi encontrado no banco.`,
        THIS_METHOD,
      );
      return;
    } else if (isEnabledFlag.getValueAsBoolean() === false) {
      logLog(this.logger,
        `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' = 'false'.` +
        ` Para ativar, altere na tabela 'setting'`,
        THIS_METHOD,
      );
      return;
    }

    const mailRecipients =
      await this.settingsService.findManyBySettingDataGroup(
        appSettings.any__mail_report_recipient,
      );

    if (!mailRecipients) {
      logError(this.logger,
        `Tarefa cancelada pois a configuração 'mail.statusReportRecipients'` +
        ` não foi encontrada (retornou: ${mailRecipients}).`,
        'sendStatusReport()',
      );
      return;
    } else if (
      mailRecipients.some((i) => !validateEmail(i.getValueAsString()))
    ) {
      logError(this.logger,
        `Tarefa cancelada pois a configuração 'mail.statusReportRecipients'` +
        ` não contém uma lista de emails válidos. Retornou: ${mailRecipients}.`,
        THIS_METHOD);
      return;
    }

    // Send mail
    const emails = mailRecipients.reduce(
      (l: string[], i) => [...l, i.getValueAsString()],
      [],
    );
    try {
      const mailSentInfo = await this.mailService.sendStatusReport({
        to: emails,
        data: {
          statusCount: await this.mailHistoryService.getStatusCount(),
        },
      } as any);

      // Success
      if (mailSentInfo.success === true) {
        logLog(this.logger,
          `Relatório enviado com sucesso para os emails ${emails}`,
          THIS_METHOD,
        );
      }

      // SMTP error
      else {
        logError(this.logger,
          `Relatório enviado para os emails ${emails} retornou erro`,
          THIS_METHOD,
          mailSentInfo,
          new Error(),
        );
      }

      // API error
    } catch (httpException) {
      logError(this.logger,
        `Email falhou ao enviar para ${emails}`,
        THIS_METHOD,
        httpException,
        httpException as Error,
      );
    }
    logLog(this.logger, 'Tarefa finalizada.', THIS_METHOD);
  }

  async pollDb() {
    const THIS_METHOD = `${this.pollDb.name}()`;
    const settingPollDbActive = await this.settingsService.findOneBySettingData(
      appSettings.any__poll_db_enabled,
    );
    if (!settingPollDbActive) {
      logError(this.logger,
        `Tarefa cancelada pois 'setting.${appSettings.any__poll_db_enabled.name}' não foi encontrado no banco.`,
        THIS_METHOD,
      );
      return;
    }
    if (!settingPollDbActive.getValueAsBoolean()) {
      logLog(this.logger,
        `Tarefa cancelada pois setting.${appSettings.any__poll_db_enabled.name}' = 'false'` +
        ` Para ativar, altere na tabela 'setting'`,
        THIS_METHOD,
      );
      return;
    }

    let hasDbChanges = false;

    const cronjobSettings: ICronJobSetting[] = [
      {
        setting: appSettings.any__poll_db_cronjob,
        cronJob: CrobJobsEnum.pollDb,
      },
      {
        setting: appSettings.any__mail_invite_cronjob,
        cronJob: CrobJobsEnum.bulkSendInvites,
      },
      {
        setting: appSettings.any__mail_report_cronjob,
        cronJob: CrobJobsEnum.sendStatusReport,
      },
    ];
    for (const setting of cronjobSettings) {
      const dbChanged = await this.handleCronjobSettings(setting, THIS_METHOD);
      if (dbChanged) {
        hasDbChanges = true;
      }
    }

    if (hasDbChanges) {
      logLog(this.logger, 'Tarefa finalizada.', THIS_METHOD);
    } else {
      logLog(this.logger, 'Tarefa finalizada, sem alterações no banco.', THIS_METHOD);
    }
  }

  async handleCronjobSettings(
    args: ICronJobSetting,
    thisMethod: string,
  ): Promise<boolean> {
    const { settingFound, isSettingValid } = await this.validateCronjobSetting(
      args,
      thisMethod,
    );
    if (!settingFound || !isSettingValid) {
      return false;
    }
    const setting = settingFound.getValueAsString();
    const jobIndex = this.jobsConfig.findIndex((i) => i.name === args.cronJob);
    const job = this.jobsConfig[jobIndex];
    if (job.cronJobParameters.cronTime !== setting) {
      logLog(this.logger,
        `Alteração encontrada em` +
        ` setting.'${args.setting.name}': ` +
        `${job?.cronJobParameters.cronTime} --> ${setting}.`,
        thisMethod,
      );
      job.cronJobParameters.cronTime = setting;
      this.jobsConfig[jobIndex] = job;
      this.deleteCron(job.name);
      this.startCron(job);
      logLog(this.logger,
        `Tarefa reagendada: ${job.name}, ${job.cronJobParameters.cronTime}`,
        thisMethod,
      );
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
    const settingFound = await this.settingsService.findOneBySettingData(
      args.setting,
    );
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

    const isEnabledFlag = await this.settingsService.getOneBySettingData(
      args.isEnabledFlag,
      true,
      thisMethod,
    );
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
    const THIS_METHOD = `${this.bulkResendInvites.name}()`;
    const notRegisteredUsers = await this.usersService.getNotRegisteredUsers();

    if (notRegisteredUsers.length === 0) {
      logLog(this.logger, 'Não há usuários para enviar, abortando...', THIS_METHOD);
      return HttpStatus.NOT_FOUND;
    }
    logLog(this.logger,
      'Enviando emails específicos para ' +
      `${notRegisteredUsers.length} usuários não totalmente registrados`,
      THIS_METHOD,
    );
    for (const user of notRegisteredUsers) {
      await this.resendInvite(user, THIS_METHOD);
    }
    return HttpStatus.OK;
  }

  async resendInvite(user: User, outerMethod: string) {
    const THIS_METHOD = `${outerMethod} > ${this.resendInvite.name}`;
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
        const mailHistory = await this.mailHistoryService.getOne({ user: { email: user.email as string } });
        logLog(this.logger,
          `Email enviado com sucesso para ${mailSentInfo.envelope.to}. (último envio: ${mailHistory.sentAt?.toISOString()})`,
          THIS_METHOD,
        );
        await this.mailHistoryService.update(mailHistory.id, {
          sentAt: new Date(Date.now())
        });
      }

      // SMTP error
      else {
        logError(this.logger,
          'Email enviado retornou erro.',
          THIS_METHOD,
          mailSentInfo,
          new Error(),
        );
      }
    } catch (httpException) {
      // API error
      logError(this.logger,
        'Email falhou ao enviar.',
        THIS_METHOD,
        httpException,
        httpException as Error,
      );
    }
  }

  async updateTransacao1() {
    const METHOD = 'updateTransacao()';
    try {
      logLog(this.logger, 'Iniciando tarefa.', METHOD);
      await this.cnabService.updateTransacaoFromJae();
      logLog(this.logger,
        'Tabelas: Favorecido, Transacao e ItemTransacao atualizados com sucesso.',
        METHOD
      );
    } catch (error) {
      logError(this.logger,
        'ERRO CRÍTICO',
        METHOD,
        error,
        error as Error,
      );
      this.startCron(this.staticJobs.updateTransacao2);
      // enviar email para: raphael, william, bernardo...
    }
  }

  async updateTransacao2() {
    const METHOD = 'updateTransacaoWeek2()';
    try {
      logLog(this.logger, 'Iniciando tarefa.', METHOD);
      await this.cnabService.updateTransacaoFromJae();
      logLog(this.logger,
        'Tabelas: Favorecido, Transacao e ItemTransacao atualizados com sucesso.',
        METHOD
      );
    } catch (error) {
      logError(this.logger,
        'ERRO CRÍTICO (TENTATIVA 2)',
        METHOD,
        error,
        error as Error,
      );
      this.deleteCron(CrobJobsEnum.updateTransacao2);
      // enviar email para: raphael, william, bernardo...
    }
  }

  async updateRemessa() {
    const METHOD = 'updateRemessa()';
    try {
      logLog(this.logger, 'Iniciando tarefa.', METHOD);
      await this.cnabService.updateRemessa();
      logLog(this.logger, 'Tarefa finalizada com sucesso.', METHOD);
    } catch (error) {
      logError(this.logger,
        'Erro, abortando.',
        METHOD,
        error,
        error as Error,
      );
    }
  }

  async updateRetorno() {
    const METHOD = 'updateRetorno()';
    try {
      await this.cnabService.updateRetorno();
      logLog(this.logger, 'Tarefa finalizada com sucesso.', METHOD);
    } catch (error) {
      logError(this.logger,
        'Erro, abortando.',
        METHOD,
        error,
        error as Error,
      );
    }
  }

  async updateExtrato() {
    const METHOD = 'updateExtrato()';
    try {
      await this.cnabService.updateExtrato();
      logLog(this.logger, 'Tarefa finalizada com sucesso.', METHOD);
    } catch (error) {
      logError(this.logger,
        'Erro, abortando.',
        METHOD,
        error,
        error as Error,
      );
    }
  }
}
