import { HttpStatus } from '@nestjs/common';
import { differenceInSeconds } from 'date-fns';
import { IMaildevEmail } from 'src/utils/interfaces/maildev-email.interface';
import * as request from 'supertest';
import { APP_URL, MAILDEV_URL } from '../utils/constants';

describe('CronJobs (e2e)', () => {
  const app = APP_URL;

  describe('Setup tests', () => {
    it('should have mailDev server', async () => {
      await request(MAILDEV_URL).get('').expect(HttpStatus.OK);
    });
  });

  describe('BulkResendMails', () => {
    test('Resend mails to not fully registered users', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 7 - GitHub}
     */ async () => {
      // Arrange
      await request(app)
        .get('/api/v1/test/cron-jobs/bulk-resend-invites')
        .expect(200);
      const resendInvitesDate = new Date();

      const mails = await request(MAILDEV_URL)
        .get('/email')
        .then(({ body }) =>
          (body as IMaildevEmail[])
            .filter(
              (mail) =>
                differenceInSeconds(resendInvitesDate, new Date(mail.date)) <=
                10,
            )
            .map((mail) => ({
              purpose: mail.text.split(' ')?.[0],
              URL: mail.text.split(' ')?.[1],
              to: mail.headers.to,
              date: mail.date,
            })),
        );

      //  Assert
      const queuedUser = mails.filter(
        (i) => i.to === 'queued.user@example.com',
      )[0];
      const sentUser = mails.filter((i) => i.to === 'sent.user@example.com')[0];
      const usedUser = mails.filter((i) => i.to === 'used.user@example.com')[0];
      const registeredUser = mails.filter(
        (i) => i.to === 'queued.user@example.com',
      )[0];

      expect(queuedUser).toBeUndefined();
      expect(sentUser).toBeDefined();
      expect(usedUser).toBeDefined();
      expect(registeredUser).toBeUndefined();

      expect(sentUser.purpose).toEqual('reminder-complete-registration');
      expect(usedUser.purpose).toEqual('reminder-complete-registration');

      expect(sentUser.URL).toContain('/conclude-registration/');
      expect(usedUser.URL).toContain('/sign-in');
    }, 20000);
  });
});
