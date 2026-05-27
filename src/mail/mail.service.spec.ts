import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let mailerService: { sendMail: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    mailerService = {
      sendMail: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'mail.previewOnly') {
          return true;
        }
        if (key === 'app.frontendDomain') {
          return 'http://localhost:3000/';
        }
        return undefined;
      }),
    };

    service = new MailService(
      mailerService as unknown as MailerService,
      configService as any,
      {} as any,
      {} as any,
    );
  });

  it('prints the conclude registration payload and skips SMTP when preview-only mode is enabled', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const response = await service.sendConcludeRegistration({
      to: 'invite.regression@example.com',
      data: {
        hash: 'hash_123',
        userName: 'Invite Regression User',
      },
    });

    expect(mailerService.sendMail).not.toHaveBeenCalled();
    expect(response.mailSentInfo.success).toBe(true);
    expect(response.mailSentInfo.response.code).toBe(250);
    expect(response.mailConfirmationLink).toBe(
      'http://localhost:3000/conclude-registration/hash_123',
    );
    expect(consoleLogSpy).toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });
});
