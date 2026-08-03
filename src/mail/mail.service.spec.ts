import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from 'src/settings/settings.service';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { MailService } from './mail.service';
import { RoleEnum } from 'src/roles/roles.enum';

describe('MailService', () => {
  let service: MailService;
  let mailerService: MailerService;

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
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get<MailerService>(MailerService);
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
        roleId: RoleEnum.agents,
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
});
