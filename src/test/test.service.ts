import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { subDays } from 'date-fns';
import { CronJobsService } from 'src/cron-jobs/cron-jobs.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { In } from 'typeorm/find-options/operator/In';

@Injectable()
export class TestService {
  constructor(
    private readonly cronjobsService: CronJobsService,
    private readonly mailHistoryService: MailHistoryService,
  ) { }

  async getCronJobsBulkResendInvites() {
    await this.setMailsToTestResendInvites();
    const result = await this.cronjobsService.bulkResendInvites();
    if (result !== HttpStatus.OK) {
      throw new HttpException('CronJob failed', result);
    }
  }

  private async setMailsToTestResendInvites() {
    const testMails =
      (await this.mailHistoryService.find({
        email: In([
          'sent.user@example.com',
          'used.user@example.com',
          'registered.user@example.com',
        ]),
      })) || [];
    const testSent15 = await this.mailHistoryService.getOne({
      email: 'sent15.user@example.com',
    });

    const now = new Date();
    for (const mail of testMails) {
      await this.mailHistoryService.update(mail.id, {
        sentAt: now,
      });
    }
    await this.mailHistoryService.update(testSent15.id, {
      sentAt: subDays(now, 16),
    });
  }

  async getResetTestingUsers() {
    const queuedMailName = 'queued.user@example.com';
    const queuedMail = await this.mailHistoryService.getOne({
      email: queuedMailName,
    });
    await this.mailHistoryService.update(queuedMail.id, {
      sentAt: null,
      inviteStatus: new InviteStatus(InviteStatusEnum.queued),
    });
  }
}
