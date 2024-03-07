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
import {
  formatErrorMessage as formatErrorLog,
  formatLog,
} from 'src/utils/log-utils';
import { validateEmail } from 'validations-br';

/**
 * Enum CronJobServicesJobs
 */
export enum CrobJobsEnum {
  bulkSendInvites = 'bulkSendInvites',
  sendStatusReport = 'sendStatusReport',
  pollDb = 'pollDb',
  bulkResendInvites = 'bulkResendInvites',
  updateTransacaoFromJae = 'updateTransacaoFromJae',
  sendNewCNABs = 'sendNewCNABs',
  getRetornoCNAB = 'getRetornoCNAB',
  updateRemessa = 'updateRemessa',
  updateRetorno = 'updateRetorno'
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
export class CronJobsService implements OnModuleInit {
  private logger = new Logger('CronJobsService', { timestamp: true });

  public jobsConfig: ICronJob[] = [];

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
    const THIS_CLASS_WITH_METHOD = `${CronJobsService.name}.${this.onModuleInit.name}`;
    (async () => {
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
            cronTime: '45 14 * * *', // 14:45 GMT = 11:45BRT (GMT-3)
            onTick: async () => {
              await this.bulkResendInvites();
            },
          },
        },
        {
          name: CrobJobsEnum.updateTransacaoFromJae,
          cronJobParameters: {
            cronTime: '45 14 * * *', // 14:45 GMT = 11:45BRT (GMT-3)
            onTick: async () => {
              await this.bulkResendInvites();
            },
          },
        },
        {
          name: CrobJobsEnum.updateRemessa,
          cronJobParameters: {
            cronTime: '45 14 * * *', // 14:45 GMT = 11:45BRT (GMT-3)
            onTick: async () => {
              await this.updateRemessa();
            },
          },
        },
        {
          name: CrobJobsEnum.getRetornoCNAB,
          cronJobParameters: {
            cronTime: '45 14 * * *', // 14:45 GMT = 11:45BRT (GMT-3)
            onTick: async () => {
              await this.getRetornoCNAB();
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
    })().catch((error: Error) => {
      throw error;
    });
  }

  startCron(jobConfig: ICronJob) {
    const job = new CronJob(jobConfig.cronJobParameters);
    this.schedulerRegistry.addCronJob(jobConfig.name, job);
    job.start();
  }

  deleteCron(jobConfig: ICronJob) {
    this.schedulerRegistry.deleteCronJob(jobConfig.name);
  }

  async bulkSendInvites() {
    const THIS_METHOD = `${this.bulkSendInvites.name}()`;
    const THIS_CLASS_AND_METHOD = `${CronJobsService}.${this.bulkSendInvites.name}()`;
    const activateAutoSendInvite =
      await this.settingsService.findOneBySettingData(
        appSettings.any__activate_auto_send_invite,
      );
    if (!activateAutoSendInvite) {
      this.logger.error(
        formatLog(
          `Tarefa cancelada pois 'setting.${appSettings.any__activate_auto_send_invite.name}' não foi encontrado no banco.`,
          THIS_METHOD,
        ),
      );
      return;
    } else if (activateAutoSendInvite.getValueAsBoolean() === false) {
      this.logger.log(
        formatLog(
          `Tarefa cancelada pois 'setting.${appSettings.any__activate_auto_send_invite.name}' = 'false'.` +
          ` Para ativar, altere na tabela 'setting'`,
          THIS_METHOD,
        ),
      );
      return;
    }

    // get data
    const sentToday = (await this.mailHistoryService.findSentToday()) || [];
    const unsent = (await this.mailHistoryService.findUnsent()) || [];
    const remainingQuota = await this.mailHistoryService.getRemainingQuota();
    const dailyQuota = () => this.configService.getOrThrow('mail.dailyQuota');

    this.logger.log(
      formatLog(
        `Iniciando tarefa - a enviar: ${unsent.length},` +
        ` enviado: ${sentToday.length}/${dailyQuota()},` +
        ` falta enviar: ${remainingQuota}`,
        THIS_METHOD,
      ),
    );

    for (let i = 0; i < remainingQuota && i < unsent.length; i++) {
      const invite = new MailHistory(unsent[i]);

      const user = await this.usersService.findOne({ id: invite.user.id });

      // User mail error
      if (!user?.email) {
        this.logger.error(
          formatLog(
            `Usuário não tem email válido (${user?.email}), este email não será enviado.`,
            THIS_METHOD,
          ),
        );
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
          this.logger.log(formatLog('Email enviado com sucesso.', THIS_METHOD));
        }

        // SMTP error
        else {
          this.logger.error(
            formatErrorLog(
              'Email enviado retornou erro.',
              mailSentInfo,
              new Error(),
              THIS_METHOD,
            ),
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
        this.logger.error(
          formatErrorLog(
            'Email falhou ao enviar.',
            httpException,
            httpException as Error,
            THIS_METHOD,
          ),
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
      this.logger.log(
        formatLog(`Tarefa cancelada pois ${reasons.join(' e ')}`, THIS_METHOD),
      );
    } else {
      this.logger.log(formatLog('Tarefa finalizada com sucesso.', THIS_METHOD));
    }
  }

  async sendStatusReport() {
    this.logger.log(formatLog('Iniciando tarefa.', 'sendStatusReport()'));
    const THIS_METHOD = `${this.sendStatusReport.name}()`;

    const isEnabledFlag = await this.settingsService.findOneBySettingData(
      appSettings.any__mail_report_enabled,
    );
    if (!isEnabledFlag) {
      this.logger.error(
        formatLog(
          `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' não foi encontrado no banco.`,
          THIS_METHOD,
        ),
      );
      return;
    } else if (isEnabledFlag.getValueAsBoolean() === false) {
      this.logger.log(
        formatLog(
          `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' = 'false'.` +
          ` Para ativar, altere na tabela 'setting'`,
          THIS_METHOD,
        ),
      );
      return;
    }

    if (!isEnabledFlag) {
      this.logger.error(
        formatLog(
          `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' não foi encontrado no banco.`,
          THIS_METHOD,
        ),
      );
      return;
    } else if (isEnabledFlag.getValueAsBoolean() === false) {
      this.logger.log(
        formatLog(
          `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' = 'false'.` +
          ` Para ativar, altere na tabela 'setting'`,
          THIS_METHOD,
        ),
      );
      return;
    }

    const mailRecipients =
      await this.settingsService.findManyBySettingDataGroup(
        appSettings.any__mail_report_recipient,
      );

    if (!mailRecipients) {
      this.logger.error(
        formatLog(
          `Tarefa cancelada pois a configuração 'mail.statusReportRecipients'` +
          ` não foi encontrada (retornou: ${mailRecipients}).`,
          'sendStatusReport()',
        ),
      );
      return;
    } else if (
      mailRecipients.some((i) => !validateEmail(i.getValueAsString()))
    ) {
      this.logger.error(
        formatLog(
          `Tarefa cancelada pois a configuração 'mail.statusReportRecipients'` +
          ` não contém uma lista de emails válidos. Retornou: ${mailRecipients}.`,
          THIS_METHOD,
        ),
      );
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
        this.logger.log(
          formatLog(
            `Relatório enviado com sucesso para os emails ${emails}`,
            THIS_METHOD,
          ),
        );
      }

      // SMTP error
      else {
        this.logger.error(
          formatErrorLog(
            `Relatório enviado para os emails ${emails} retornou erro`,
            mailSentInfo,
            new Error(),
            THIS_METHOD,
          ),
        );
      }

      // API error
    } catch (httpException) {
      this.logger.error(
        formatErrorLog(
          `Email falhou ao enviar para ${emails}`,
          httpException,
          httpException as Error,
          THIS_METHOD,
        ),
      );
    }
    this.logger.log(formatLog('Tarefa finalizada.', THIS_METHOD));
  }

  async pollDb() {
    const THIS_METHOD = `${this.pollDb.name}()`;
    const settingPollDbActive = await this.settingsService.findOneBySettingData(
      appSettings.any__poll_db_enabled,
    );
    if (!settingPollDbActive) {
      this.logger.error(
        formatLog(
          `Tarefa cancelada pois 'setting.${appSettings.any__poll_db_enabled.name}' não foi encontrado no banco.`,
          THIS_METHOD,
        ),
      );
      return;
    }
    if (!settingPollDbActive.getValueAsBoolean()) {
      this.logger.log(
        formatLog(
          `Tarefa cancelada pois setting.${appSettings.any__poll_db_enabled.name}' = 'false'` +
          ` Para ativar, altere na tabela 'setting'`,
          THIS_METHOD,
        ),
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
      this.logger.log(formatLog('Tarefa finalizada.', THIS_METHOD));
    } else {
      this.logger.log(
        formatLog('Tarefa finalizada, sem alterações no banco.', THIS_METHOD),
      );
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
      this.logger.log(
        formatLog(
          `Alteração encontrada em` +
          ` setting.'${args.setting.name}': ` +
          `${job?.cronJobParameters.cronTime} --> ${setting}.`,
          thisMethod,
        ),
      );
      job.cronJobParameters.cronTime = setting;
      this.jobsConfig[jobIndex] = job;
      this.deleteCron(job);
      this.startCron(job);
      this.logger.log(
        formatLog(
          `Tarefa reagendada: ${job.name}, ${job.cronJobParameters.cronTime}`,
          thisMethod,
        ),
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
      this.logger.log(
        formatLog('Não há usuários para enviar, abortando...', THIS_METHOD),
      );
      return HttpStatus.NOT_FOUND;
    }
    this.logger.log(
      formatLog(
        String(
          'Enviando emails específicos para ' +
          `${notRegisteredUsers.length} usuários não totalmente registrados`,
        ),
        THIS_METHOD,
      ),
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
        this.logger.log(
          formatLog(
            `Email enviado com sucesso para ${mailSentInfo.envelope.to}.`,
            THIS_METHOD,
          ),
        );
      }

      // SMTP error
      else {
        this.logger.error(
          formatErrorLog(
            'Email enviado retornou erro.',
            mailSentInfo,
            new Error(),
            THIS_METHOD,
          ),
        );
      }
    } catch (httpException) {
      // API error
      this.logger.error(
        formatErrorLog(
          'Email falhou ao enviar.',
          httpException,
          httpException as Error,
          THIS_METHOD,
        ),
      );
    }
  }

  async updateTransacaoFromJae() {
    await this.cnabService.updateTransacaoFromJae();
  }

  async getRetornoCNAB(){
    await this.cnabService.getArquivoRetornoCNAB();
  }

  async updateRemessa() {
    const METHOD = 'updateRemessa()';
    try {
      await this.cnabService.updateRemessa();
    } catch (error) {
      this.logger.error(formatLog(
        `Erro, abortando: ${(error as Error).message}.`
        , METHOD));
    }
  }

  async updateRetorno() {
    const METHOD = 'updateRetorno()';
    try {
      await this.cnabService.updateRetorno();
    } catch (error) {
      this.logger.error(formatLog(
        `Erro, abortando: ${(error as Error).message}.`
        , METHOD));
    }
  }
}