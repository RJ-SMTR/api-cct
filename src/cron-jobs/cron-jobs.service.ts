import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob, CronJobParameters } from 'cron';
import { CnabService } from 'src/cnab/cnab.service';
import { PagadorContaEnum } from 'src/cnab/enums/pagamento/pagador.enum';
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
import { OnModuleLoad } from 'src/utils/interfaces/on-load.interface';
import { validateEmail } from 'validations-br';

/**
 * Enum CronJobServicesJobs
 */
export enum CrobJobsEnum {
  bulkSendInvites = 'bulkSendInvites',
  sendStatusReport = 'sendStatusReport',
  pollDb = 'pollDb',
  bulkResendInvites = 'bulkResendInvites',
  saveTransacoesJae = 'saveTransacoesJae',
  saveTransacoesJae2 = 'saveTransacoesJae2',
  saveTransacoesLancamento = 'saveTransacoesLancamento',
  saveTransacoesLancamento2 = 'saveTransacoesLancamento2',
  sendRemessa = 'sendRemessa',
  updateRetorno = 'updateRetorno',
  saveExtrato = 'saveExtrato',
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

/**
 * CronJob tasks and management
 */
@Injectable()
export class CronJobsService implements OnModuleInit, OnModuleLoad {
  private logger = new CustomLogger(CronJobsService.name, { timestamp: true });

  public jobsConfig: ICronJob[] = [];
  public staticJobs = {
    saveTransacoesJae2: {
      name: CrobJobsEnum.saveTransacoesJae2,
      cronJobParameters: {
        cronTime: '30 6 * * *', // 03:30 BRT = 06:30 UTC
        onTick: async () => {
          await this.saveTransacoesJae2();
        },
      },
    } as ICronJob,
    saveTransacoesLancamento2: {
      name: CrobJobsEnum.saveTransacoesLancamento2,
      cronJobParameters: {
        cronTime: '30 6 * * *', // 03:30 BRT = 06:30 UTC
        onTick: async () => {
          await this.saveTransacoesLancamento2();
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
  ) {}

  onModuleInit() {
    this.onModuleLoad().catch((error: Error) => {
      throw error;
    });
  }

  async onModuleLoad() {
    const THIS_CLASS_WITH_METHOD = 'CronJobsService.onModuleLoad';

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
      {
        name: CrobJobsEnum.saveTransacoesJae,
        cronJobParameters: {
          cronTime: '0 3 * * 5', // Every friday, 00:00 BRT = 03:00 GMT
          onTick: async () => {
            await this.saveTransacoesJae1();
          },
        },
      },
      {
        name: CrobJobsEnum.sendRemessa,
        cronJobParameters: {
          cronTime: '0 4 * * 5', // Every friday, 01:00 BRT = 04:00 GMT
          onTick: async () => {
            await this.sendRemessa();
          },
        },
      },
      {
        name: CrobJobsEnum.updateRetorno,
        cronJobParameters: {
          cronTime: '*/30 * * * *', // Every 30 min
          onTick: async () => {
            await this.updateRetorno();
          },
        },
      },
      // {
      //   name: CrobJobsEnum.saveExtrato,
      //   cronJobParameters: {
      //     cronTime: '0 */6 * * *', // Every 6h GMT (3h BRT)
      //     onTick: async () => {
      //       await this.saveExtrato();
      //     },
      //   },
      // },
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
    const METHOD = this.bulkSendInvites.name;
    const activateAutoSendInvite =
      await this.settingsService.findOneBySettingData(
        appSettings.any__activate_auto_send_invite,
      );
    if (!activateAutoSendInvite) {
      this.logger.log(
        `Tarefa cancelada pois 'setting.${appSettings.any__activate_auto_send_invite.name}' ` +
          ' não foi encontrado no banco.',
        METHOD,
      );
      return;
    } else if (activateAutoSendInvite.getValueAsBoolean() === false) {
      this.logger.log(
        `Tarefa cancelada pois 'setting.${appSettings.any__activate_auto_send_invite.name}' = 'false'.` +
          ` Para ativar, altere na tabela 'setting'`,
        METHOD,
      );
      return;
    }

    // get data
    const sentToday = (await this.mailHistoryService.findSentToday()) || [];
    const unsent = (await this.mailHistoryService.findUnsent()) || [];
    const remainingQuota = await this.mailHistoryService.getRemainingQuota();
    const dailyQuota = () => this.configService.getOrThrow('mail.dailyQuota');

    this.logger.log(
      `Iniciando tarefa - a enviar: ${unsent.length},` +
        ` enviado: ${sentToday.length}/${dailyQuota()},` +
        ` falta enviar: ${remainingQuota}`,
      METHOD,
    );

    for (let i = 0; i < remainingQuota && i < unsent.length; i++) {
      const invite = new MailHistory(unsent[i]);

      const user = await this.usersService.findOne({ id: invite.user.id });

      // User mail error
      if (!user?.email) {
        this.logger.error(
          `Usuário não tem email válido (${user?.email}), este email não será enviado.`,
          METHOD,
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
          METHOD,
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
            METHOD,
          );
          this.logger.log('Email enviado com sucesso.', METHOD);
        }

        // SMTP error
        else {
          this.logger.error(
            `Email enviado retornou erro. - mailSentInfo: ${mailSentInfo}`,
            new Error().stack,
            METHOD,
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
            METHOD,
          );
        }

        // API error
      } catch (httpException) {
        this.logger.error(
          'Email falhou ao enviar.',
          httpException.stack,
          METHOD,
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
          METHOD,
        );
      }
    }
    if (unsent.length == 0 || remainingQuota == 0) {
      const reasons: string[] = [
        ...(unsent.length == 0 ? ['no mails to sent'] : []),
        ...(remainingQuota == 0 ? ['no remaining quota'] : []),
      ];
      this.logger.log(`Tarefa cancelada pois ${reasons.join(' e ')}`, METHOD);
    } else {
      this.logger.log('Tarefa finalizada com sucesso.', METHOD);
    }
  }

  async sendStatusReport() {
    const METHOD = this.sendStatusReport.name;
    this.logger.log('Iniciando tarefa.', METHOD);

    const isEnabledFlag = await this.settingsService.findOneBySettingData(
      appSettings.any__mail_report_enabled,
    );
    if (!isEnabledFlag) {
      this.logger.error(
        `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' ` +
          'não foi encontrado no banco.',
        undefined,
        METHOD,
      );
      return;
    } else if (isEnabledFlag.getValueAsBoolean() === false) {
      this.logger.log(
        `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' = 'false'.` +
          ` Para ativar, altere na tabela 'setting'`,
        METHOD,
      );
      return;
    }

    if (!isEnabledFlag) {
      this.logger.error(
        `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' ` +
          'não foi encontrado no banco.',
        undefined,
        METHOD,
      );
      return;
    } else if (isEnabledFlag.getValueAsBoolean() === false) {
      this.logger.log(
        `Tarefa cancelada pois 'setting.${appSettings.any__mail_report_enabled.name}' = 'false'.` +
          ` Para ativar, altere na tabela 'setting'`,
        METHOD,
      );
      return;
    }

    const mailRecipients =
      await this.settingsService.findManyBySettingDataGroup(
        appSettings.any__mail_report_recipient,
      );

    if (!mailRecipients) {
      this.logger.error(
        `Tarefa cancelada pois a configuração 'mail.statusReportRecipients'` +
          ` não foi encontrada (retornou: ${mailRecipients}).`,
        undefined,
        METHOD,
      );
      return;
    } else if (
      mailRecipients.some((i) => !validateEmail(i.getValueAsString()))
    ) {
      this.logger.error(
        `Tarefa cancelada pois a configuração 'mail.statusReportRecipients'` +
          ` não contém uma lista de emails válidos. Retornou: ${mailRecipients}.`,
        undefined,
        METHOD,
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
          `Relatório enviado com sucesso para os emails ${emails}`,
          METHOD,
        );
      }

      // SMTP error
      else {
        this.logger.error(
          `Relatório enviado para os emails ${emails} retornou erro. - ` +
            `mailSentInfo: ${JSON.stringify(mailSentInfo)}`,
          new Error().stack,
          METHOD,
        );
      }

      // API error
    } catch (httpException) {
      this.logger.error(
        `Email falhou ao enviar para ${emails}`,
        httpException?.stack,
        METHOD,
      );
    }
    this.logger.log('Tarefa finalizada.', METHOD);
  }

  async pollDb() {
    const METHOD = this.pollDb.name;
    const settingPollDbActive = await this.settingsService.findOneBySettingData(
      appSettings.any__poll_db_enabled,
    );
    if (!settingPollDbActive) {
      this.logger.error(
        `Tarefa cancelada pois 'setting.${appSettings.any__poll_db_enabled.name}' não foi encontrado no banco.`,
        new Error().stack,
        METHOD,
      );
      return;
    }
    if (!settingPollDbActive.getValueAsBoolean()) {
      this.logger.log(
        `Tarefa cancelada pois setting.${appSettings.any__poll_db_enabled.name}' = 'false'` +
          ` Para ativar, altere na tabela 'setting'`,
        METHOD,
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
      const dbChanged = await this.handleCronjobSettings(setting, METHOD);
      if (dbChanged) {
        hasDbChanges = true;
      }
    }

    if (hasDbChanges) {
      this.logger.log('Tarefa finalizada.', METHOD);
    } else {
      this.logger.log('Tarefa finalizada, sem alterações no banco.', METHOD);
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
        `Alteração encontrada em` +
          ` setting.'${args.setting.name}': ` +
          `${job?.cronJobParameters.cronTime} --> ${setting}.`,
        thisMethod,
      );
      job.cronJobParameters.cronTime = setting;
      this.jobsConfig[jobIndex] = job;
      this.deleteCron(job.name);
      this.startCron(job);
      this.logger.log(
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
    const METHOD = this.bulkResendInvites.name;
    const notRegisteredUsers = await this.usersService.getNotRegisteredUsers();

    if (notRegisteredUsers.length === 0) {
      this.logger.log('Não há usuários para enviar, abortando...', METHOD);
      return HttpStatus.NOT_FOUND;
    }
    this.logger.log(
      'Enviando emails específicos para ' +
        `${notRegisteredUsers.length} usuários não totalmente registrados`,
      METHOD,
    );
    for (const user of notRegisteredUsers) {
      await this.resendInvite(user, METHOD);
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
        const mailHistory = await this.mailHistoryService.getOne({
          user: { email: user.email as string },
        });
        this.logger.log(
          `Email enviado com sucesso para ${
            mailSentInfo.envelope.to
          }. (último envio: ${mailHistory.sentAt?.toISOString()})`,
          THIS_METHOD,
        );
        await this.mailHistoryService.update(mailHistory.id, {
          sentAt: new Date(Date.now()),
        });
      }

      // SMTP error
      else {
        this.logger.error(
          'Email enviado retornou erro.' +
            ` - mailSentInfo: ${JSON.stringify(mailSentInfo)}`,
          new Error().stack,
          THIS_METHOD,
        );
      }
    } catch (httpException) {
      // API error
      this.logger.error(
        'Email falhou ao enviar.',
        httpException.stack,
        THIS_METHOD,
      );
    }
  }

  async saveTransacoesLancamento1() {
    const METHOD = this.saveTransacoesLancamento1.name;
    try {
      this.logger.log('Iniciando tarefa.', METHOD);
      await this.cnabService.saveTransacoesLancamento();
      this.logger.log(
        'Tabelas para o Lancamento atualizados com sucesso.',
        METHOD,
      );
    } catch (error) {
      this.logger.error(
        `ERRO CRÍTICO - ${JSON.stringify(error)}`,
        error?.stack,
        METHOD,
      );
      this.startCron(this.staticJobs.saveTransacoesLancamento2);
      // enviar email para: raphael, william, bernardo...
    }
  }

  async saveTransacoesLancamento2() {
    const METHOD = this.saveTransacoesLancamento2.name;
    try {
      this.logger.log('Iniciando tarefa.', METHOD);
      await this.cnabService.saveTransacoesLancamento();
      this.logger.log(
        'Tabelas para o Lancamento atualizados com sucesso.',
        METHOD,
      );
    } catch (error) {
      this.logger.error(
        `ERRO CRÍTICO (TENTATIVA 2) = ${error}`,
        error.stack,
        METHOD,
      );
      this.deleteCron(CrobJobsEnum.saveTransacoesLancamento2);
      // enviar email para: raphael, william, bernardo...
    }
  }

  async getIsCnabJobEnabled(method?: string) {
    const cnabJobEnabled = await this.settingsService.getOneBySettingData(
      cnabSettings.any__cnab_jobs_enabled,
    );
    if (method !== undefined && !cnabJobEnabled.getValueAsBoolean()) {
      this.logger.log(
        `Tarefa ignorada pois está desabilitada em ${cnabSettings.any__cnab_jobs_enabled.name}`,
        method,
      );
    }
    return cnabJobEnabled.getValueAsBoolean();
  }

  async saveTransacoesJae1() {
    const METHOD = this.saveTransacoesJae1.name;

    if (!(await this.getIsCnabJobEnabled(METHOD))) {
      return;
    }

    try {
      this.logger.log('Iniciando tarefa.', METHOD);
      await this.cnabService.saveTransacoesJae();
      this.logger.log('Tabelas para o Jaé atualizados com sucesso.', METHOD);
    } catch (error) {
      this.logger.error(`ERRO CRÍTICO - ${error}`, error?.stack, METHOD);
      this.startCron(this.staticJobs.saveTransacoesJae2);
      // TODO: enviar email para: raphael, william, bernardo...
    }
  }

  async saveTransacoesJae2() {
    const METHOD = this.saveTransacoesJae2.name;

    if (!(await this.getIsCnabJobEnabled(METHOD))) {
      return;
    }

    try {
      this.logger.log('Iniciando tarefa.', METHOD);
      await this.cnabService.saveTransacoesJae();
      this.logger.log('Tabelas para o Jaé atualizados com sucesso.', METHOD);
    } catch (error) {
      this.logger.error(
        `ERRO CRÍTICO (TENTATIVA 2) = ${error}`,
        error.stack,
        METHOD,
      );
      this.deleteCron(CrobJobsEnum.saveTransacoesJae2);
      // enviar email para: raphael, william, bernardo...
    }
  }

  async sendRemessa() {
    const METHOD = this.sendRemessa.name;

    if (!(await this.getIsCnabJobEnabled(METHOD))) {
      return;
    }

    try {
      this.logger.log('Iniciando tarefa.', METHOD);
      await this.cnabService.sendRemessa(PagadorContaEnum.ContaBilhetagem);
      // await this.cnabService.sendRemessa(PagadorContaEnum.CETT);
      this.logger.log('Tarefa finalizada com sucesso.', METHOD);
    } catch (error) {
      this.logger.error('Erro, abortando.', error.stack, METHOD);
    }
  }

  async updateRetorno() {
    const METHOD = this.updateRetorno.name;

    if (!(await this.getIsCnabJobEnabled(METHOD))) {
      return;
    }

    try {
      await this.cnabService.updateRetorno();
      this.logger.log('Tarefa finalizada com sucesso.', METHOD);
    } catch (error) {
      this.logger.error(`Erro, abortando. - ${error}`, error.stack, METHOD);
    }
  }

  async saveExtrato() {
    const METHOD = this.saveExtrato.name;

    if (!(await this.getIsCnabJobEnabled(METHOD))) {
      return;
    }

    try {
      await this.cnabService.saveExtrato();
      this.logger.log('Tarefa finalizada com sucesso.', METHOD);
    } catch (error) {
      this.logger.error(`Erro, abortando. - ${error}`, error.stack, METHOD);
    }
  }
}
