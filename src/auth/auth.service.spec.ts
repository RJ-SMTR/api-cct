import { HttpException, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { ForgotService } from 'src/forgot/forgot.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { MailRegistrationInterface } from 'src/mail/interfaces/mail-registration.interface';
import { MailService } from 'src/mail/mail.service';
import { UsersService } from 'src/users/users.service';
import { DeepPartial } from 'typeorm';
import { AuthService } from './auth.service';

process.env.TZ = 'UTC';

/**
 * All tests below were based on the requirements on GitHub.
 * @see {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 Requirements - GitHub}
 */
describe('AuthService', () => {
  let authService: AuthService;
  let mailService: MailService;
  let mailHistoryService: MailHistoryService;

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
      },
    } as Provider;
    const mailServiceMock = {
      provide: MailService,
      useValue: {
        userConcludeRegistration: jest.fn(),
        forgotPassword: jest.fn(),
      },
    } as Provider;
    const coreBankServiceMock = {
      provide: CoreBankService,
      useValue: {
        updateDataIfNeeded: jest.fn(),
      },
    } as Provider;
    const mailHistoryServiceMock = {
      provide: MailHistoryService,
      useValue: {
        findOne: jest.fn(),
        update: jest.fn(),
        getRemainingQuota: jest.fn(),
        findNotUsed: jest.fn(),
      },
    } as Provider;
    const jwtServiceMock = {
      provide: JwtService,
      useValue: {
        sign: jest.fn(),
      },
    } as Provider;
    const configServiceMock = {
      provide: ConfigService,
      useValue: {
        getOrThrow: jest.fn(),
      },
    } as Provider;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        jwtServiceMock,
        usersServiceMock,
        forgotServiceMock,
        mailServiceMock,
        coreBankServiceMock,
        mailHistoryServiceMock,
        configServiceMock,
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    mailHistoryService = module.get<MailHistoryService>(MailHistoryService);
    mailService = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  it('should always be UTC', () => {
    expect(new Date().getTimezoneOffset()).toBe(0);
  });

  describe('resendAllRegisterEmails', () => {
    it('should return (re)sent mails and failed ones', async () => {
      // Arrange
      const statuses = [
        InviteStatusEnum.queued,
        InviteStatusEnum.queued,
        InviteStatusEnum.sent,
        InviteStatusEnum.resent,
      ];
      const mails: MailHistory[] = [];
      const mailsResponse: DeepPartial<MailHistory>[] = [];
      for (const i in statuses) {
        const inviteStatus = new InviteStatus(statuses[i]);
        const newMail: DeepPartial<MailHistory> = {
          id: Number(i),
          user: {
            id: Number(i),
            email: `user${i}@mail.com`,
            fullName: `User ${i}`,
          },
          inviteStatus,
        };
        mails.push(new MailHistory(newMail));
        mailsResponse.push({
          id: newMail.id,
          user: newMail.user,
        });
      }
      const mailResponse = {
        mailConfirmationLink: 'link',
        mailSentInfo: {
          success: true,
        },
      } as MailRegistrationInterface;
      const dateNow = new Date('2023-01-01T10:00:00');

      jest.spyOn(mailHistoryService, 'getRemainingQuota').mockResolvedValue(4);
      jest.spyOn(mailHistoryService, 'findNotUsed').mockResolvedValue(mails);
      jest
        .spyOn(mailService, 'userConcludeRegistration')
        .mockResolvedValueOnce(mailResponse)
        .mockRejectedValueOnce(new HttpException('error', 500))
        .mockResolvedValueOnce(mailResponse)
        .mockResolvedValueOnce(mailResponse);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => dateNow.valueOf());

      // Act
      const response = await authService.resendAllRegisterMails();

      // Assert
      expect(response).toEqual({
        total: mails.length,
        sent: 3,
        failed: 1,
        sentMailData: [
          ...mailsResponse.slice(0, 1),
          ...mailsResponse.slice(2, 4),
        ],
        failedMailData: [...mailsResponse.slice(1, 2)],
      });
    });

    it('should update status of successfull mails only and other properties', async () => {
      // Arrange
      const statuses = [
        InviteStatusEnum.queued,
        InviteStatusEnum.sent,
        InviteStatusEnum.resent,
        InviteStatusEnum.queued,
      ];
      const mails: MailHistory[] = [];
      const mailsResponse: DeepPartial<MailHistory>[] = [];
      for (const i in statuses) {
        const index = Number(i) + 1;
        const inviteStatus = new InviteStatus(statuses[i]);
        const newMail: DeepPartial<MailHistory> = {
          id: index,
          user: {
            id: index,
            email: `user${index}@mail.com`,
            fullName: `User ${index}`,
          },
          inviteStatus,
        };
        mails.push(new MailHistory(newMail));
        mailsResponse.push({
          id: newMail.id,
          user: newMail.user,
        });
      }
      const mailResponse = {
        mailConfirmationLink: 'link',
        mailSentInfo: {
          success: true,
        },
      } as MailRegistrationInterface;
      const dateNow = '2023-01-01T10:00:00';

      jest.spyOn(mailHistoryService, 'getRemainingQuota').mockResolvedValue(4);
      jest.spyOn(mailHistoryService, 'findNotUsed').mockResolvedValue(mails);
      jest
        .spyOn(mailService, 'userConcludeRegistration')
        .mockResolvedValueOnce(mailResponse)
        .mockRejectedValueOnce(new HttpException('error', 500))
        .mockResolvedValueOnce(mailResponse)
        .mockResolvedValueOnce(mailResponse);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date(dateNow).valueOf());

      // Act
      await authService.resendAllRegisterMails();

      // Assert

      // queued ok
      const expected1 = new MailHistory(mails[0]);
      expected1.setInviteStatus(InviteStatusEnum.sent);
      expected1.setInviteError({ httpErrorCode: null, smtpErrorCode: null });
      expected1.sentAt = new Date(dateNow);
      expected1.failedAt = null;

      // queued error
      const expected2 = new MailHistory(mails[1]);
      expected2.setInviteStatus(InviteStatusEnum.sent);
      expected2.setInviteError({ httpErrorCode: 500, smtpErrorCode: null });
      expected2.sentAt = null;
      expected2.failedAt = new Date(dateNow);

      // sent ok
      const expected3 = new MailHistory(mails[2]);
      expected3.setInviteStatus(InviteStatusEnum.resent);
      expected3.setInviteError({ httpErrorCode: null, smtpErrorCode: null });
      expected3.sentAt = new Date(dateNow);
      expected3.failedAt = null;

      // resent ok
      const expected4 = new MailHistory(mails[3]);
      expected4.setInviteStatus(InviteStatusEnum.sent);
      expected4.setInviteError({ httpErrorCode: null, smtpErrorCode: null });
      expected4.sentAt = new Date(dateNow);
      expected4.failedAt = null;

      expect(mailHistoryService.update).toHaveBeenCalledTimes(4);
      expect(mailHistoryService.update).toHaveBeenNthCalledWith(
        1,
        1,
        expected1,
      );
      expect(mailHistoryService.update).toHaveBeenNthCalledWith(
        2,
        2,
        expected2,
      );
      expect(mailHistoryService.update).toHaveBeenNthCalledWith(
        3,
        3,
        expected3,
      );
      expect(mailHistoryService.update).toHaveBeenNthCalledWith(
        4,
        4,
        expected4,
      );
    });
  });
});
