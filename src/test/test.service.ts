import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { subDays } from 'date-fns';
import { CronJobsService } from 'src/cron-jobs/cron-jobs.service';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { In } from 'typeorm/find-options/operator/In';

@Injectable()
export class TestService {
  constructor(
    private readonly cronjobsService: CronJobsService,
    private readonly mailHistoryService: MailHistoryService,
  ) {}

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
          'queued.user@example.com',
          'sent.user@example.com',
          'used.user@example.com',
          'registered.user@example.com',
        ]),
      })) || [];
    const now = new Date();
    for (const mail of testMails) {
      await this.mailHistoryService.update(mail.id, {
        sentAt: subDays(now, 16),
      });
    }
  }
}
