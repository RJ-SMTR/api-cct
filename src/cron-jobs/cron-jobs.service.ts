import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob, CronJobParameters } from 'cron';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { InviteStatusEnum } from 'src/invite-statuses/invite-status.enum';
import { MailHistory } from 'src/invite/entities/invite.entity';
import { MailHistoryService } from 'src/invite/mail-history.service';
import { JaeService } from 'src/jae/jae.service';
import { MailService } from 'src/mail/mail.service';
import { appSettings } from 'src/settings/app.settings';
import { SettingsService } from 'src/settings/settings.service';
import { UsersService } from 'src/users/users.service';

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
      this.logger.log(`Job started: ${jobConfig.name}`);
    }
  }

  async updateJaeMockedData() {
    this.logger.log(`updateJaeMockedData(): updating data if needed`);
    await this.jaeService.updateDataIfNeeded();
  }

  updateCoreBankMockedData() {
    this.logger.log(`updateCoreBankMockedData(): updating data if needed`);
    this.coreBankService.updateDataIfNeeded();
  }

  async bulkSendInvites() {
    const activateAutoSendInvite =
      await this.settingsService.getOneBySettingData(
        appSettings.any__activate_auto_send_invite,
      );
    if (activateAutoSendInvite.value === String(false)) {
      this.logger.log(
        `bulkSendInvites(): job finished because ${appSettings.any__activate_auto_send_invite.name} = 'false'`,
      );
      return;
    }

    // get data
    const sentToday = (await this.mailHistoryService.findSentToday()) || [];
    const unsent = (await this.mailHistoryService.findUnsent()) || [];
    const remainingQuota = await this.mailHistoryService.getRemainingQuota();

    this.logger.log(
      `bulkSendInvites(): starting job. unsent: ${unsent.length}, sent: ${sentToday.length}/N, `
      + `remaining: ${remainingQuota}`,
    );

    for (
      let i = 0;
      i < remainingQuota && i < unsent.length;
      i++
    ) {
      const invite = new MailHistory(unsent[i]);

      const user = await this.usersService.findOne({ id: invite.user.id });

      // User mail error
      if (!user?.email) {
        this.logger.error(
          'bulkSendInvites(): valid user email not found, this email cant be sent.',
        );
        invite.setInviteError({
          httpErrorCode: HttpStatus.UNPROCESSABLE_ENTITY,
          smtpErrorCode: null,
        });
        await this.mailHistoryService.update(invite.id, invite);
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
          await this.mailHistoryService.update(invite.id, invite);
          this.logger.log('bulkSendInvites(): invite sent successfully.');
        }

        // SMTP error
        else {
          this.logger.error(
            'bulkSendInvites(): invite sent returned error' +
              '\n    - Message: ' +
              JSON.stringify(mailSentInfo) +
              '\n    - Traceback:\n' +
              new Error().stack,
          );
          invite.setInviteError({
            httpErrorCode: HttpStatus.INTERNAL_SERVER_ERROR,
            smtpErrorCode: mailSentInfo.response.code,
          });
          await this.mailHistoryService.update(invite.id, invite);
        }

        // API error
      } catch (httpException) {
        this.logger.error(
          'bulkSendInvites(): invite failed to send' +
            '\n    - Message: ' +
            JSON.stringify(httpException) +
            '\n    - Traceback:\n' +
            (httpException as Error).stack,
        );
        invite.httpErrorCode = httpException.statusCode;
        invite.setInviteError({
          httpErrorCode: HttpStatus.INTERNAL_SERVER_ERROR,
          smtpErrorCode: null,
        });
        await this.mailHistoryService.update(invite.id, invite);
      }
    }
    this.logger.log('bulkSendInvites(): job finished');
  }
}
