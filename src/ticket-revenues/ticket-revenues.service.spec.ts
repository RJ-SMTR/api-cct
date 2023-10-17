import { Test, TestingModule } from '@nestjs/testing';
import { TicketRevenuesService } from './ticket-revenues.service';
import { Provider } from '@nestjs/common';
import { JaeService } from 'src/jae/jae.service';
import { User } from 'src/users/entities/user.entity';
import { IJaeTicketRevenue } from 'src/jae/interfaces/jae-ticket-revenue.interface';

describe('TicketRevenuesService', () => {
  let ticketRevenuesService: TicketRevenuesService;
  let jaeService: JaeService;

  beforeEach(async () => {
    const jaeServiceMock = {
      provide: JaeService,
      useValue: {
        getTicketRevenuesByPermitCode: jest.fn(),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketRevenuesService, jaeServiceMock],
    }).compile();
    jest
      .spyOn(global.Date, 'now')
      .mockImplementation(() => new Date('2023-06-01T06:00:00.000Z').valueOf());

    ticketRevenuesService = module.get<TicketRevenuesService>(
      TicketRevenuesService,
    );
    jaeService = module.get<JaeService>(JaeService);
  });

  it('should be defined', () => {
    expect(ticketRevenuesService).toBeDefined();
  });

  describe('getDataFromUser', () => {
    it('should return a slice of data when successfull', async () => {
      // Arrange
      const expectedResult: IJaeTicketRevenue[] = [];
      for (let day = 3; day >= 1; day--) {
        for (let i = 3; i >= 1; i--) {
          const dayStr = day.toString().padStart(2, '0');
          const hourStr = (i * 10).toString().padStart(2, '0');
          expectedResult.push({
            id: i,
            paymentMediaType: `media_${i}`,
            transportIntegrationType: `integration_${i}`,
            transactionType: `transaction_${i}`,
            transactionDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
            transactionValue: i,
            transactionLat: i,
            transactionLon: i,
            vehicleOrderNumberId: i,
            permitCode: `permitCode_${i}`,
            // Extra fields
            clientId: `clientId_${i}`,
            integrationId: i,
            individualIntegrationId: i,
            dateIndex: `dateIndex_${i}`,
            processingDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
            captureDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
            vehicleService: i,
            directionId: i,
            stopId: `stopId_${i}`,
            stopLat: i,
            stopLon: i,
          });
        }
      }
      const user = {
        id: 1,
        permitCode: 'permitCode_1',
      } as Partial<User>;
      jest
        .spyOn(jaeService, 'getTicketRevenuesByPermitCode')
        .mockResolvedValue(expectedResult);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() =>
          new Date('2023-06-03T06:30:00.000Z').valueOf(),
        );

      // Act
      const resultPreviousDays = await ticketRevenuesService.getDataFromUser(
        user as unknown as User,
        { previousDays: 1 },
        { limit: 9999, page: 1 },
      );
      const resultBetweenDates = await ticketRevenuesService.getDataFromUser(
        user as unknown as User,
        {
          startDate: '2023-06-01',
          endDate: '2023-06-03',
        },
        { limit: 9999, page: 1 },
      );
      // Assert
      expect(resultPreviousDays).toEqual(expectedResult.slice(0, 6));
      expect(resultBetweenDates).toEqual(expectedResult.slice(3, 9));
    });
  });
});
