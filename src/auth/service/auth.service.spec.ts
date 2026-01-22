import { Provider } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ForgotService } from 'src/forgot/forgot.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { MailRegistrationInterface } from 'src/mail/interfaces/mail-registration.interface';
import { MailSentInfo } from 'src/mail/interfaces/mail-sent-info.interface';
import { MailService } from 'src/mail/mail.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { DeepPartial } from 'typeorm';
import { AuthService } from './auth.service';

process.env.TZ = 'UTC';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let mailService: MailService;
  let mailHistoryService: MailHistoryService;
  let forgotService: ForgotService;

  beforeEach(async () => {
    const usersServiceMock = {
      provide: UsersService,
      useValue: {
        create: jest.fn(),
        getOne: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
      },
    } as Provider;
    const forgotServiceMock = {
      provide: ForgotService,
      useValue: {
        findOne: jest.fn(),
        create: jest.fn(),
        generateHash: jest.fn(),
      },
    } as Provider;
    const mailServiceMock = {
      provide: MailService,
      useValue: {
        sendConcludeRegistration: jest.fn(),
        sendForgotPassword: jest.fn(),
      },
    } as Provider;
    const mailHistoryServiceMock = {
      provide: MailHistoryService,
      useValue: {
        findOne: jest.fn(),
        getOne: jest.fn(),
        getRemainingQuota: jest.fn(),
        update: jest.fn(),
      },
    } as Provider;
    const jwtServiceMock = {
      provide: JwtService,
      useValue: {
        sign: jest.fn(),
      },
    } as Provider;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        jwtServiceMock,
        usersServiceMock,
        forgotServiceMock,
        mailServiceMock,
        mailHistoryServiceMock,
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    mailHistoryService = module.get<MailHistoryService>(MailHistoryService);
    forgotService = module.get<ForgotService>(ForgotService);
    mailService = module.get<MailService>(MailService);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  xdescribe('resendRegisterMail', () => {
    it('should throw exception when no mail quota available', async () => {
      // Arrange
      const user = new User({
        id: 1,
        email: 'user1@example.com',
        hash: 'hash_1',
      });
      const mailHistory = { id: 1, user: user, hash: 'hash_1' } as MailHistory;
      jest.spyOn(usersService, 'getOne').mockResolvedValue(user);
      jest.spyOn(mailHistoryService, 'findOne').mockResolvedValue(mailHistory);
      jest.spyOn(mailHistoryService, 'getRemainingQuota').mockResolvedValue(0);

      // Act
      const response = authService.resendRegisterMail({ id: 1 });

      // Assert
      await expect(response).rejects.toThrowError();
    });

    it('should return success regardless of quota status', /**
     * Requirement: 2023/12/28 {@link https://github.com/RJ-SMTR/api-cct/issues/164#issuecomment-1871504885 #164 - GitHub}
     */ async () => {
      // Arrange
      const users = [
        new User({ id: 1, email: 'user1@mail.com', hash: 'hash_1' }),
        new User({ id: 2, email: 'user2@mail.com', hash: 'hash_2' }),
        new User({ id: 3, email: 'user3@mail.com', hash: 'hash_3' }),
      ];
      const mailResponse = {
        mailConfirmationLink: 'link',
        mailSentInfo: {
          success: true,
        },
      } as MailRegistrationInterface;
      const mailHistories = [
        new MailHistory({ id: 1, user: users[0], hash: 'hash_1' }),
        new MailHistory({ id: 2, user: users[1], hash: 'hash_2' }),
        new MailHistory({ id: 3, user: users[2], hash: 'hash_3' }),
      ];
      mailHistories[0].setInviteStatus(InviteStatusEnum.queued);
      mailHistories[1].setInviteStatus(InviteStatusEnum.sent);
      mailHistories[2].setInviteStatus(InviteStatusEnum.used);
      const dateNow = new Date('2023-01-01T10:00:00');
      const updatedMailHistory = {
        sentAt: dateNow,
        inviteStatus: new InviteStatus(InviteStatusEnum.sent),
      } as DeepPartial<MailHistory>;

      for (let i = 0; i < 3; i++) {
        jest.spyOn(usersService, 'getOne').mockResolvedValue(users[i]);
        jest
          .spyOn(mailHistoryService, 'findOne')
          .mockResolvedValue(mailHistories[i]);
        jest
          .spyOn(mailHistoryService, 'getRemainingQuota')
          .mockResolvedValue(1);
        jest
          .spyOn(mailService, 'sendConcludeRegistration')
          .mockResolvedValue(mailResponse);
        jest
          .spyOn(global.Date, 'now')
          .mockImplementation(() => dateNow.valueOf());

        // Act
        const responsePromise = authService.resendRegisterMail(users[i]);

        // Assert
        await expect(responsePromise).resolves.not.toThrowError();
        expect(mailHistoryService.update).toBeCalledWith(
          i + 1,
          updatedMailHistory,
          expect.any(String),
        );
      }
    });
  });

  describe('forgotPassword', () => {
    it('should throw exception when no mail quota available', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 16 - GitHub}
     */ async () => {
      // Arrange
      jest.spyOn(mailHistoryService, 'getRemainingQuota').mockResolvedValue(0);

      // Act
      const responsePromise = authService.forgotPassword('user@mail.com');

      // Assert
      await expect(responsePromise).rejects.toThrowError();
    });

    it('should not consume the quota when available', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 17 - GitHub}
     */ async () => {
      // Arrange
      const user = new User({ id: 1, email: 'user1@mail.com', hash: 'hash_1' });
      const mailSentInfo = {
        success: true,
      } as MailSentInfo;
      const mailHistory = new MailHistory({
        id: 1,
        user: user,
        hash: 'hash_1',
      });
      mailHistory.setInviteStatus(InviteStatusEnum.queued);
      const dateNow = new Date('2023-01-01T10:00:00');
      const updatedMailHistory = new MailHistory({
        ...mailHistory,
        sentAt: dateNow,
      });
      updatedMailHistory.setInviteStatus(InviteStatusEnum.sent);

      jest.spyOn(usersService, 'findOne').mockResolvedValue(user);
      jest
        .spyOn(forgotService, 'generateHash')
        .mockResolvedValue('unique_hash');
      jest.spyOn(mailHistoryService, 'getRemainingQuota').mockResolvedValue(1);
      jest.spyOn(mailHistoryService, 'getOne').mockResolvedValue(mailHistory);
      jest
        .spyOn(mailService, 'sendForgotPassword')
        .mockResolvedValue(mailSentInfo);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => dateNow.valueOf());

      // Act
      await authService.forgotPassword(user.email as string);

      // Assert
      expect(mailHistoryService.update).toBeCalledTimes(0);
    });
  });
});
