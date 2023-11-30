import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob, CronJobParameters } from 'cron';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { JaeService } from 'src/jae/jae.service';
import { MailService } from 'src/mail/mail.service';
import { appSettings } from 'src/settings/app.settings';
import { SettingsService } from 'src/settings/settings.service';
import { UsersService } from 'src/users/users.service';
import {
  formatErrorMessage as formatErrorLog,
  formatLog,
} from 'src/utils/logging';

export enum CronJobsServiceJobs {
  bulkSendInvites = 'bulkSendInvites',
  updateJaeMockedData = 'updateJaeMockedData',
  updateCoreBankMockedData = 'updateCoreBankMockedData',
}

interface ICronJob {
  name: string;
  cronJobParameters: CronJobParameters;
}

@Injectable()
export class CronJobsService implements OnModuleInit {
  private logger = new Logger('CronJobsService', { timestamp: true });

  public jobsConfig: ICronJob[] = [
    {
      name: CronJobsServiceJobs.bulkSendInvites,
      cronJobParameters: {
        cronTime: this.configService.getOrThrow('mail.inviteCronjob'),
        onTick: async () => this.bulkSendInvites(),
      },
    },
    {
      name: CronJobsServiceJobs.updateJaeMockedData,
      cronJobParameters: {
        cronTime: CronExpression.EVERY_MINUTE,
        onTick: async () => this.updateJaeMockedData(),
      },
    },
    {
      name: CronJobsServiceJobs.updateCoreBankMockedData,
      cronJobParameters: {
        cronTime: CronExpression.EVERY_DAY_AT_6AM,
        onTick: () => this.coreBankService.updateDataIfNeeded(),
      },
    },
  ];

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    private schedulerRegistry: SchedulerRegistry,
    private mailService: MailService,
    private mailHistoryService: MailHistoryService,
    private jaeService: JaeService,
    private coreBankService: CoreBankService,
    private usersService: UsersService,
  ) {}

  onModuleInit() {
    for (const jobConfig of this.jobsConfig) {
      const job = new CronJob(jobConfig.cronJobParameters);
      this.schedulerRegistry.addCronJob(jobConfig.name, job);
      job.start();
      this.logger.log(`Tarefa iniciada: ${jobConfig.name}`);
    }
  }

  async updateJaeMockedData() {
    this.logger.log(`updateJaeMockedData(): Atualizando dados se necessário`);
    await this.jaeService.updateDataIfNeeded();
  }

  updateCoreBankMockedData() {
    this.logger.log(
      `updateCoreBankMockedData(): Atualizando dados se necessário`,
    );
    this.coreBankService.updateDataIfNeeded();
  }

  async bulkSendInvites() {
    const activateAutoSendInvite =
      await this.settingsService.getOneBySettingData(
        appSettings.any__activate_auto_send_invite,
      );
    if (activateAutoSendInvite.value === String(false)) {
      this.logger.log(
        `bulkSendInvites(): Tarefa cancelada pois ${appSettings.any__activate_auto_send_invite.name} = 'false'.` +
          ` Para ativar, altere na tabela 'setting'`,
      );
      return;
    }

    // get data
    const sentToday = (await this.mailHistoryService.findSentToday()) || [];
    const unsent = (await this.mailHistoryService.findUnsent()) || [];
    const remainingQuota = await this.mailHistoryService.getRemainingQuota();
    const dailyQuota = () => this.configService.getOrThrow('mail.dailyQuota');

    this.logger.log(
      `bulkSendInvites(): iniciando tarefa: a enviar: ${
        unsent.length
      }, enviado: ${sentToday.length}/${dailyQuota()}, ` +
        `falta enviar: ${remainingQuota}`,
    );

    for (let i = 0; i < remainingQuota && i < unsent.length; i++) {
      const invite = new MailHistory(unsent[i]);

      const user = await this.usersService.findOne({ id: invite.user.id });

      // User mail error
      if (!user?.email) {
        this.logger.error(
          formatLog(
            `Usuário não tem email válido (${user?.email}), este email não será enviado.`,
            'bulkSendInvites()',
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
          'CronJobsService.bulkSendInvites()',
        );
        continue;
      }

      // Send mail
      try {
        const { mailSentInfo } =
          await this.mailService.userConcludeRegistration({
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
            'CronJobsService.bulkSendInvites()',
          );
          this.logger.log(
            formatLog('Email enviado com sucesso.', 'bulkSendInvites()'),
          );
        }

        // SMTP error
        else {
          this.logger.error(
            formatErrorLog(
              'Email enviado retornou erro.',
              mailSentInfo,
              new Error(),
              'bulkSendInvites()',
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
            'CronJobsService.bulkSendInvites()',
          );
        }

        // API error
      } catch (httpException) {
        this.logger.error(
          formatErrorLog(
            'Email falhou ao enviar.',
            httpException,
            httpException as Error,
            'bulkSendInvites()',
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
          'CronJobsService.bulkSendInvites()',
        );
      }
    }
    if (unsent.length == 0 || remainingQuota == 0) {
      const reasons: string[] = [
        ...(unsent.length == 0 ? ['no mails to sent'] : []),
        ...(remainingQuota == 0 ? ['no remaining quota'] : []),
      ];
      this.logger.log(
        formatLog(
          `Tarefa cancelada pois ${reasons.join(' e ')}`,
          'bulkSendInvites()',
        ),
      );
    } else {
      this.logger.log(
        formatLog('Tarefa finalizada com sucesso.', 'bulkSendInvites()'),
      );
    }
  }
}
