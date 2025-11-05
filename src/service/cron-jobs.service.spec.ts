import { Test, TestingModule } from '@nestjs/testing';
import { CronJobsService } from './cron-jobs.service';
import { ConfigService } from '@nestjs/config';
import { Provider } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SettingsService } from 'src/configuration/settings/settings.service';
import { SettingEntity } from 'src/configuration/settings/entities/setting.entity';
import { Role } from 'src/security/roles/entities/role.entity';

import { RoleEnum } from 'src/security/roles/roles.enum';

import { DeepPartial } from 'typeorm';
import { InviteStatus } from 'src/domain/entity/mail-history-status.entity';
import { MailHistory } from 'src/domain/entity/mail-history.entity';
import { User } from 'src/domain/entity/user.entity';
import { InviteStatusEnum } from 'src/domain/enum/mail-history-status.enum';
import { MailRegistrationInterface } from 'src/domain/interface/mail-registration.interface';
import { MailHistoryService } from './mail-history.service';
import { MailService } from './mail.service';
import { UsersService } from './users.service';

xdescribe('CronJobsService', () => {
  let cronJobsService: CronJobsService;
  let settingsService: SettingsService;
  let mailHistoryService: MailHistoryService;
  let mailService: MailService;
  let usersService: UsersService;

  beforeEach(async () => {
    const configServiceMock = {
      provide: ConfigService,
      useValue: {
        getOrThrow: jest.fn(),
      },
    } as Provider;
    const settingsServiceMock = {
      provide: SettingsService,
      useValue: {
        getOneBySettingData: jest.fn(),
        findOneBySettingData: jest.fn(),
      },
    } as Provider;
    const mailHistoryServiceMock = {
      provide: MailHistoryService,
      useValue: {
        findSentToday: jest.fn(),
        findUnsent: jest.fn(),
        getRemainingQuota: jest.fn(),
        update: jest.fn(),
      },
    } as Provider;
    const mailServiceMock = {
      provide: MailService,
      useValue: {
        sendConcludeRegistration: jest.fn(),
      },
    } as Provider;
    const usersServiceMock = {
      provide: UsersService,
      useValue: {
        findOne: jest.fn(),
      },
    } as Provider;
    const schedulerRegistryMock = {
      provide: SchedulerRegistry,
      useValue: {
        addCronJob: jest.fn(),
      },
    } as Provider;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronJobsService,
        configServiceMock,
        settingsServiceMock,
        mailHistoryServiceMock,
        mailServiceMock,
        usersServiceMock,
        schedulerRegistryMock,
      ],
    }).compile();

    cronJobsService = module.get<CronJobsService>(CronJobsService);
    settingsService = module.get<SettingsService>(SettingsService);
    mailHistoryService = module.get<MailHistoryService>(MailHistoryService);
    mailService = module.get<MailService>(MailService);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(cronJobsService).toBeDefined();
  });

  describe('bulkSendInvites', () => {
    xit('[FIXME] should abort if no mail quota available', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 11 - GitHub}
     */ async () => {
      // Arrange
      jest
        .spyOn(settingsService, 'findOneBySettingData')
        .mockResolvedValue({ value: 'true' } as SettingEntity);
      jest.spyOn(mailHistoryService, 'findSentToday').mockResolvedValue([]);
      jest
        .spyOn(mailHistoryService, 'findUnsent')
        .mockResolvedValue([{ id: 1 }, { id: 2 }] as MailHistory[]);
      jest.spyOn(mailHistoryService, 'getRemainingQuota').mockResolvedValue(0);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-01').valueOf());

      // Act
      await cronJobsService.bulkSendInvites();

      // Assert
      expect(usersService.findOne).toBeCalledTimes(0);
      expect(mailService.sendConcludeRegistration).toBeCalledTimes(0);
    });

    xit('[FIXME] should set mail status to SENT when succeeded', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 12 - GitHub}
     */ async () => {
      // Arrange
      const dateNow = new Date('2023-01-01T10:00:00');
      const user = new User({
        id: 1,
        email: 'user1@example.com',
        hash: 'hash_1',
        permitCode: 'permitCode1',
        role: new Role(RoleEnum.user),
      });
      const mailHistory = {
        id: 1,
        user: user,
        hash: 'hash_1',
        inviteStatus: new InviteStatus(InviteStatusEnum.sent),
        sentAt: dateNow,
      } as MailHistory;
      const updatedMailHistory = {
        failedAt: null,
        sentAt: dateNow,
        httpErrorCode: null,
        smtpErrorCode: null,
        inviteStatus: new InviteStatus(InviteStatusEnum.sent),
      } as DeepPartial<MailHistory>;
      const mailResponse = {
        mailConfirmationLink: 'link',
        mailSentInfo: {
          success: true,
        },
      } as MailRegistrationInterface;

      jest
        .spyOn(settingsService, 'findOneBySettingData')
        .mockResolvedValue({ value: 'true' } as SettingEntity);
      jest.spyOn(mailHistoryService, 'findSentToday').mockResolvedValue([]);
      jest
        .spyOn(mailHistoryService, 'findUnsent')
        .mockResolvedValue([mailHistory] as MailHistory[]);
      jest.spyOn(mailHistoryService, 'getRemainingQuota').mockResolvedValue(1);
      jest.spyOn(usersService, 'findOne').mockResolvedValue(user);
      jest
        .spyOn(mailService, 'sendConcludeRegistration')
        .mockResolvedValue(mailResponse);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => dateNow.valueOf());

      // Act
      await cronJobsService.bulkSendInvites();

      // Assert
      expect(usersService.findOne).toBeCalled();
      expect(mailService.sendConcludeRegistration).toBeCalled();
      expect(mailHistoryService.update).toBeCalledWith(
        1,
        updatedMailHistory,
        expect.any(String),
      );
    });
  });
});
