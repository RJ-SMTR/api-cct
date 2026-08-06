import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { SettingsService } from 'src/settings/settings.service';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { User } from 'src/users/entities/user.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { MailService } from './mail.service';
import { RoleEnum } from 'src/roles/roles.enum';

describe('MailService', () => {
  let service: MailService;
  let mailerService: MailerService;
  let mailHistoryService: MailHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'app.frontendDomain') {
                return 'https://frontend.example/';
              }
              if (key === 'mail.senderNotification') {
                return 'no-reply@example.com';
              }
              if (key === 'app.name') {
                return 'CCT';
              }
              return null;
            }),
          },
        },
        {
          provide: SettingsService,
          useValue: {},
        },
        {
          provide: MailHistoryService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get<MailerService>(MailerService);
    mailHistoryService = module.get<MailHistoryService>(MailHistoryService);
  });

  it('uses the agent activation template for agent users', async () => {
    jest.spyOn(mailerService, 'sendMail').mockResolvedValue({
      response: '250 OK',
      ehlo: [],
    } as any);

    await service.sendConcludeRegistration({
      to: 'agent@example.com',
      data: {
        hash: 'hash-1',
        userName: 'Agent Name',
        roleId: RoleEnum.agentes,
      },
    });

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'activation-agent',
      }),
    );
  });

  it('uses the default activation template for non-agent users', async () => {
    jest.spyOn(mailerService, 'sendMail').mockResolvedValue({
      response: '250 OK',
      ehlo: [],
    } as any);

    await service.sendConcludeRegistration({
      to: 'user@example.com',
      data: {
        hash: 'hash-2',
        userName: 'Regular User',
        roleId: RoleEnum.user,
      },
    });

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'activation',
      }),
    );
  });

  it('keeps the conclude-registration link for a used invite whose user is not active', async () => {
    const user = new User({
      id: 1,
      status: new Status(StatusEnum.register),
    });
    const invite = new MailHistory({
      id: 1,
      hash: 'hash-used-pending',
      user,
      inviteStatus: new InviteStatus(InviteStatusEnum.used),
    });

    jest.spyOn(mailHistoryService, 'findOne').mockResolvedValue(invite);
    jest.spyOn(mailerService, 'sendMail').mockResolvedValue({
      response: '250 OK',
      ehlo: [],
    } as any);

    await service.reSendEmailBank({
      to: 'user@example.com',
      data: {
        hash: 'hash-used-pending',
        inviteStatus: new InviteStatus(InviteStatusEnum.used),
      },
    });

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          'https://frontend.example/conclude-registration/hash-used-pending',
        ),
      }),
    );
  });
});
