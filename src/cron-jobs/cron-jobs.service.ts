import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InviteService } from 'src/invite/invite.service';
import { MailService } from 'src/mail/mail.service';
import { CronJob, CronJobParameters } from 'cron';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from 'src/settings/settings.service';
import { appSettings } from 'src/settings/app.settings';
import { InviteStatusEnum } from 'src/invite-statuses/invite-status.enum';
import { getEnumKey } from 'src/utils/get-enum-key';
import { Invite } from 'src/invite/entities/invite.entity';
import { InviteStatus } from 'src/invite-statuses/entities/invite-status.entity';
import { UsersService } from 'src/users/users.service';

export enum CronJobsServiceJobs {
  bulkSendInvites = 'bulkSendInvites',
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
  ];

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    private schedulerRegistry: SchedulerRegistry,
    private inviteService: InviteService,
    private mailService: MailService,
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
    const unsentInvites = await this.inviteService.find({
      inviteStatus: [
        {
          id: InviteStatusEnum.created,
          name: getEnumKey(InviteStatusEnum, InviteStatusEnum.created),
        },
        {
          id: InviteStatusEnum.queued,
          name: getEnumKey(InviteStatusEnum, InviteStatusEnum.queued),
        },
      ],
    });
    if (unsentInvites === null || unsentInvites.length === 0) {
      this.logger.log(`bulkSendInvites(): job finished, no invites to send`);
      return;
    }

    for (const invite of unsentInvites) {
      const newInvite = { ...invite } as Invite;

      const user = await this.usersService.findOne({ id: invite.user.id });
      if (!user?.fullName) {
        this.logger.warn(
          'bulkSendInvites(): valid user name not found, useing default name.',
        );
      }

      // User mail error
      if (!user?.email) {
        this.logger.error(
          'bulkSendInvites(): valid user email not found, this email cant be sent.',
        );
        this.inviteService.setInviteError(newInvite, {
          httpErrorCode: HttpStatus.UNPROCESSABLE_ENTITY,
          smtpErrorCode: null,
        });
        await this.inviteService.update(newInvite.id, newInvite);
        continue;
      }

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
        if (mailSentInfo.response.code === 250) {
          this.inviteService.setInviteError(newInvite, {
            httpErrorCode: null,
            smtpErrorCode: null,
          });
          newInvite.inviteStatus = new InviteStatus(InviteStatusEnum.sent);
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
          this.inviteService.setInviteError(newInvite, {
            httpErrorCode: HttpStatus.INTERNAL_SERVER_ERROR,
            smtpErrorCode: mailSentInfo.response.code,
          });
        }

        // API error
      } catch (httpException) {
        // Quota limit reached
        if (httpException?.response?.details?.error === 'quotaLimitReached') {
          this.logger.log(
            'bulkSendInvites(): no available mail senders with quota, aborting...',
          );
          break;
        }

        // Other error
        else {
          this.logger.error(
            'bulkSendInvites(): invite failed to send' +
              '\n    - Message: ' +
              JSON.stringify(httpException) +
              '\n    - Traceback:\n' +
              (httpException as Error).stack,
          );
          newInvite.httpErrorCode = httpException.statusCode;
          this.inviteService.setInviteError(newInvite, {
            httpErrorCode: HttpStatus.INTERNAL_SERVER_ERROR,
            smtpErrorCode: null,
          });
        }
      }

      await this.inviteService.update(newInvite.id, newInvite);
    }
    this.logger.log('bulkSendInvites(): job finished');
  }
}
