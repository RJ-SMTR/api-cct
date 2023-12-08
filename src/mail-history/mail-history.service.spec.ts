import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MailHistory } from './entities/mail-history.entity';
import { MailHistoryService } from './mail-history.service';

describe('InviteService', () => {
  let mailHistoryService: MailHistoryService;
  let configService: ConfigService;
  let mailHistoryRepository: Repository<MailHistory>;

  beforeEach(async () => {
    const MAIL_HSITORY_REPOSITORY_TOKEN = getRepositoryToken(MailHistory);
    const mailHistoryRepositoryMock = {
      provide: MAIL_HSITORY_REPOSITORY_TOKEN,
      useValue: {
        find: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
    } as Provider;
    const configServiceMock = {
      provide: ConfigService,
      useValue: {
        getOrThrow: jest.fn(),
      },
    } as Provider;
    const dataSourceMock = {
      provide: DataSource,
      useValue: {
        query: jest.fn(),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailHistoryService,
        mailHistoryRepositoryMock,
        configServiceMock,
        dataSourceMock,
      ],
    }).compile();

    mailHistoryService = module.get<MailHistoryService>(MailHistoryService);
    mailHistoryRepository = module.get<Repository<MailHistory>>(
      MAIL_HSITORY_REPOSITORY_TOKEN,
    );
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(mailHistoryService).toBeDefined();
  });

  /**
   * @see {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 Requirements #94 - GitHub}
   */
  describe('getUpdatedMailCounts', () => {
    it('should return quota as max value after midnight', async () => {
      // Arrange
      const findResult: Partial<MailHistory>[] = [
        {
          email: 'user1@mail.com',
          sentAt: new Date('2023-06-30T06:10:00.000Z'),
        },
        {
          email: 'user2@mail.com',
          sentAt: new Date('2023-06-30T22:00:00.000Z'),
        },
        {
          email: 'user3@mail.com',
          sentAt: new Date('2023-06-30T23:00:00.000Z'),
        },
      ];
      jest
        .spyOn(mailHistoryRepository, 'find')
        .mockResolvedValue(findResult as MailHistory[]);
      jest.spyOn(configService, 'getOrThrow').mockReturnValue(3);
      function mockDate(dateStr: string) {
        const date = new Date(dateStr);
        const dateStart = new Date(dateStr.slice(0, 10));
        jest.spyOn(global.Date, 'now').mockImplementation(() => date.valueOf());
        const sentToday = findResult.filter(
          (i) => i.sentAt && new Date(i.sentAt) >= dateStart,
        ).length;
        const createQueryBuilder: any = {
          select: () => createQueryBuilder,
          where: () => createQueryBuilder,
          orderBy: () => createQueryBuilder,
          getCount: () => sentToday,
        };
        jest
          .spyOn(mailHistoryRepository, 'createQueryBuilder')
          .mockImplementation(() => createQueryBuilder);
      }

      // Act
      mockDate('2023-06-30T06:10:00.000Z');
      const result_unchanged = await mailHistoryService.getRemainingQuota();
      mockDate('2023-07-01T00:00:00.000Z');
      const result_07_01 = await mailHistoryService.getRemainingQuota();

      // Assert
      expect(result_unchanged).toBe(0);
      expect(result_07_01).toBe(3);
    }, 35000);
  });
});
