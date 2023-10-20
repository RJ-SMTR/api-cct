import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InviteService } from 'src/invite/invite.service';
import { MailService } from 'src/mail/mail.service';
import { CronJob, CronJobParameters } from 'cron';
import { ConfigService } from '@nestjs/config';
import { MailCountService } from 'src/mail-count/mail-count.service';
import { SettingsService } from 'src/settings/settings.service';
import { appSettings } from 'src/settings/app.settings';
import { InviteStatusEnum } from 'src/invite-statuses/invite-status.enum';
import { getEnumKey } from 'src/utils/get-enum-key';
import { Invite } from 'src/invite/entities/invite.entity';
import { MailCount } from 'src/mail-count/entities/mail-count.entity';
import { InviteStatus } from 'src/invite-statuses/entities/invite-status.entity';

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
    private mailCountService: MailCountService,
    private mailService: MailService,
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
      this.logger.log(
        `bulkSendInvites(): job finished, no invites to send (created/queued)`,
      );
      return;
    }

    const mailSenders = await this.mailCountService.getUpdatedMailCounts(true);
    if (mailSenders.length === 0) {
      this.logger.warn(
        `bulkSendInvites(): job aborted, no available daily mail senders quota`,
      );
      return;
    }

    // bulk send mail
    let mailSenderIndex = 0;
    let mailSender = { ...mailSenders[mailSenderIndex] } as MailCount;
    for (const invite of unsentInvites) {
      const newInvite = { ...invite } as Invite;

      try {
        const { mailSentInfo } =
          await this.mailService.userConcludeRegistration({
            to: invite.email,
            data: {
              hash: invite.hash,
            },
          });

        // Success
        if (mailSentInfo.response.code === 250) {
          this.inviteService.setInviteError(newInvite, {
            httpErrorCode: null,
            smtpErrorCode: null,
          });
          newInvite.inviteStatus = new InviteStatus(InviteStatusEnum.sent);
          mailSender.recipientCount++;
          await this.mailCountService.update(mailSender.id, {
            recipientCount: mailSender.recipientCount,
          });
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

      await this.inviteService.update(newInvite.id, newInvite);

      // Quota limit reached
      if (mailSender.recipientCount === mailSender.maxRecipients) {
        this.logger.log(
          'bulkSendInvites(): mailSender ' +
            String(mailSenderIndex) +
            ' has reached daily sending quota',
        );
        mailSenderIndex++;
        if (mailSenderIndex >= mailSenders.length) {
          break;
        }
        mailSender = { ...mailSenders[mailSenderIndex] } as MailCount;
      }
    }
    this.logger.log('bulkSendInvites(): job finished');
  }
}
