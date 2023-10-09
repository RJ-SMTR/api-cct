import { Test, TestingModule } from '@nestjs/testing';
import { MailCountService } from './mail-count.service';
import { Repository } from 'typeorm';
import { MailCount } from './entities/mail-count.entity';
import { Provider } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('MailCountService', () => {
  let mailCountService: MailCountService;
  let mailCountRepository: Repository<MailCount>;

  beforeEach(async () => {
    const MAIL_COUNT_REPOSITORY_TOKEN = getRepositoryToken(MailCount);
    const mailCountRepositoryMock = {
      provide: MAIL_COUNT_REPOSITORY_TOKEN,
      useValue: {
        find: jest.fn(),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailCountService, mailCountRepositoryMock],
    }).compile();

    mailCountService = module.get<MailCountService>(MailCountService);
    mailCountRepository = module.get<Repository<MailCount>>(
      MAIL_COUNT_REPOSITORY_TOKEN,
    );
  });

  it('should be defined', () => {
    expect(mailCountService).toBeDefined();
    expect(mailCountRepository).toBeDefined();
  });

  describe('getUpdatedMailCounts', () => {
    it('should return updated mail counts when time passed', async () => {
      // Arrange
      const findResult: Partial<MailCount>[] = [
        {
          email: 'user1@mail.com',
          recipientCount: 1,
          maxRecipients: 3,
          updatedAt: new Date('2023-06-30T06:10:00.000Z'),
        },
        {
          email: 'user2@mail.com',
          recipientCount: 2,
          maxRecipients: 3,
          updatedAt: new Date('2023-06-30T22:00:00.000Z'),
        },
        {
          email: 'user3@mail.com',
          recipientCount: 3,
          maxRecipients: 3,
          updatedAt: new Date('2023-07-01T01:00:00.000Z'),
        },
      ];
      jest
        .spyOn(mailCountRepository, 'find')
        .mockResolvedValue(findResult as MailCount[]);
      function mockDate(date: string) {
        console.log('mockDate', date);
        jest
          .spyOn(global.Date, 'now')
          .mockImplementation(() => new Date(date).valueOf());
      }

      // Act
      mockDate('2023-06-30T06:10:00.000Z');
      const result_unchanged = await mailCountService.getUpdatedMailCounts();
      mockDate('2023-07-01T06:10:00.000Z');
      const result_06_10 = await mailCountService.getUpdatedMailCounts();
      mockDate('2023-07-01T22:00:00.000Z');
      const result_22_00 = await mailCountService.getUpdatedMailCounts();
      mockDate('2023-07-02T01:00:00.000Z');
      const result_25_00 = await mailCountService.getUpdatedMailCounts();

      // Assert
      expect(result_unchanged[0].recipientCount).toBe(1);

      expect(result_06_10[0].recipientCount).toBe(0);
      expect(result_06_10[1].recipientCount).toBe(2);
      expect(result_06_10[2].recipientCount).toBe(3);

      expect(result_22_00[0].recipientCount).toBe(0);
      expect(result_22_00[1].recipientCount).toBe(0);
      expect(result_22_00[2].recipientCount).toBe(3);

      expect(result_25_00[0].recipientCount).toBe(0);
      expect(result_25_00[1].recipientCount).toBe(0);
      expect(result_25_00[2].recipientCount).toBe(0);
    }, 35000);
  });
});
