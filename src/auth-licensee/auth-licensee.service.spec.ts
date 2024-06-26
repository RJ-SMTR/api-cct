import { Provider } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ForgotService } from 'src/forgot/forgot.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { MailService } from 'src/mail/mail.service';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { BaseValidator } from 'src/utils/validators/base-validator';
import { AuthLicenseeService } from './auth-licensee.service';

describe('AuthLicenseeService', () => {
  let authLicenseeService: AuthLicenseeService;
  let jwtService: JwtService;
  let usersService: UsersService;
  let mailHistoryService: MailHistoryService;
  let baseValidator: BaseValidator;

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
    const mailHistoryServiceMock = {
      provide: MailHistoryService,
      useValue: {
        findOne: jest.fn(),
        getOne: jest.fn(),
        getRemainingQuota: jest.fn(),
        update: jest.fn(),
        generateHash: jest.fn(),
      },
    } as Provider;
    const jwtServiceMock = {
      provide: JwtService,
      useValue: {
        sign: jest.fn(),
      },
    } as Provider;
    const BaseValidatorMock = {
      provide: BaseValidator,
      useValue: {
        validateOrReject: jest.fn(),
      },
    } as Provider;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthLicenseeService,
        jwtServiceMock,
        usersServiceMock,
        forgotServiceMock,
        mailServiceMock,
        mailHistoryServiceMock,
        BaseValidatorMock,
      ],
    }).compile();

    authLicenseeService = module.get<AuthLicenseeService>(AuthLicenseeService);
    usersService = module.get<UsersService>(UsersService);
    mailHistoryService = module.get<MailHistoryService>(MailHistoryService);
    jwtService = module.get<JwtService>(JwtService);
    jwtService = module.get<JwtService>(JwtService);
    baseValidator = module.get<BaseValidator>(BaseValidator);
  });

  it('should be defined', () => {
    expect(authLicenseeService).toBeDefined();
  });

  describe('getInviteProfile', () => {
    it('should throw exception when mail status is not SENT', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 18 - GitHub}
     */ async () => {
      // Arrange
      const user = new User({
        id: 1,
        email: 'user1@example.com',
        hash: 'hash_1',
      });
      const mailHistory = {
        id: 1,
        user: user,
        hash: 'hash_1',
        inviteStatus: new InviteStatus(InviteStatusEnum.queued),
      } as MailHistory;
      jest.spyOn(usersService, 'getOne').mockResolvedValue(user);
      jest.spyOn(mailHistoryService, 'getOne').mockResolvedValue(mailHistory);
      jest.spyOn(mailHistoryService, 'getRemainingQuota').mockResolvedValue(0);
      jest.spyOn(baseValidator, 'validateOrReject').mockResolvedValue({});

      // Act
      const response = authLicenseeService.getInviteProfile('hash_1');
      // Assert
      await expect(response).rejects.toThrowError();
    });
  });

  describe('concludeRegistration', () => {
    it('should set mail status to SENT when succeeded', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 19 - GitHub}
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
      jest.spyOn(mailHistoryService, 'findOne').mockResolvedValue(mailHistory);
      jest.spyOn(usersService, 'getOne').mockResolvedValue(user);
      jest.spyOn(usersService, 'update').mockResolvedValue(user);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => dateNow.valueOf());
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');
      jest.spyOn(baseValidator, 'validateOrReject').mockResolvedValue({});

      // Act
      await authLicenseeService.concludeRegistration(
        { password: 'secret' },
        'hash_1',
      );
      // Assert
      expect(mailHistoryService.update).toBeCalledWith(
        1,
        {
          inviteStatus: {
            id: InviteStatusEnum.used,
          },
        },
        expect.any(String),
      );
    });
  });
});
