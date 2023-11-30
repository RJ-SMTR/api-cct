import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BigqueryService } from 'src/bigquery/bigquery.service';
import { JaeService } from 'src/jae/jae.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { ITicketRevenue } from './interfaces/ticket-revenue.interface';
import { TicketRevenuesService } from './ticket-revenues.service';

describe('TicketRevenuesService', () => {
  let ticketRevenuesService: TicketRevenuesService;
  let jaeService: JaeService;
  let usersService: UsersService;

  beforeEach(async () => {
    const jaeServiceMock = {
      provide: JaeService,
      useValue: {
        getTicketRevenues: jest.fn(),
        isPermitCodeExists: jest.fn(),
      },
    } as Provider;
    const usersServiceMock = {
      provide: UsersService,
      useValue: {
        getOne: jest.fn(),
      },
    } as Provider;
    const bigqueryServiceMock = {
      provide: BigqueryService,
      useValue: {
        runQuery: jest.fn(),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketRevenuesService,
        jaeServiceMock,
        usersServiceMock,
        bigqueryServiceMock,
      ],
    }).compile();
    jest
      .spyOn(global.Date, 'now')
      .mockImplementation(() => new Date('2023-06-01T06:00:00.000Z').valueOf());

    ticketRevenuesService = module.get<TicketRevenuesService>(
      TicketRevenuesService,
    );
    jaeService = module.get<JaeService>(JaeService);
    usersService = module.get<UsersService>(UsersService);
  });

  describe('Setup tests', () => {
    test('timezone should be UTC', () => {
      expect(new Date().getTimezoneOffset()).toBe(0);
    });
  });

  it('should be defined', () => {
    expect(ticketRevenuesService).toBeDefined();
  });

  /**
   * @see {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 Requirements - GitHub}
   */
  describe('getMeGroupedFromUser', () => {
    it('should return Gratuidade = R$ 0.00', async () => {
      // Arrange
      const revenues: ITicketRevenue[] = [];
      for (let day = 3; day >= 1; day--) {
        let i = 3;
        let dayStr = day.toString().padStart(2, '0');
        let hourStr = (i * 2).toString().padStart(2, '0');
        revenues.push({
          partitionDate: `2023-06-${dayStr}`,
          processingHour: i,
          transportType: i.toString(),
          transactionId: i.toString(),
          paymentMediaType: `media_${i}`,
          transportIntegrationType: `integration_${i}`,
          transactionType: `Gratuidade`,
          transactionDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          transactionValue: 0,
          transactionLat: i,
          transactionLon: i,
          vehicleId: i.toString(),
          permitCode: `permitCode_1`,
          // Extra fields
          clientId: `clientId_${i}`,
          integrationId: i.toString(),
          processingDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          captureDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          vehicleService: i.toString(),
          directionId: i,
          stopId: i,
          stopLat: i,
          stopLon: i,
          bqDataVersion: i.toString(),
        });
        i = 2;
        dayStr = day.toString().padStart(2, '0');
        hourStr = (i * 2).toString().padStart(2, '0');
        revenues.push({
          partitionDate: `2023-06-${dayStr}`,
          processingHour: i,
          transportType: i.toString(),
          transactionId: i.toString(),
          paymentMediaType: `media_${i}`,
          transportIntegrationType: `integration_${i}`,
          transactionType: `Integral`,
          transactionDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          transactionValue: 0,
          transactionLat: i,
          transactionLon: i,
          vehicleId: i.toString(),
          permitCode: `permitCode_1`,
          // Extra fields
          clientId: `clientId_${i}`,
          integrationId: i.toString(),
          processingDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          captureDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          vehicleService: i.toString(),
          directionId: i,
          stopId: i,
          stopLat: i,
          stopLon: i,
          bqDataVersion: i.toString(),
        });
      }
      jest.spyOn(jaeService, 'getTicketRevenues').mockResolvedValue(revenues);
      jest.spyOn(jaeService, 'isPermitCodeExists').mockReturnValue(true);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() =>
          new Date('2023-06-03T03:30:00.000Z').valueOf(),
        );
      const user = new User();
      user.id = 1;
      user.permitCode = 'permitCode_1';
      jest.spyOn(usersService, 'getOne').mockResolvedValue(user);

      // Act
      const result = await ticketRevenuesService.getMeGroupedFromUser(
        {
          startDate: '2023-06-01',
          endDate: '2023-06-01',
          userId: 1,
        },
        'ticket-revenues',
      );

      // Assert
      expect(
        result.transactionTypeCounts?.['Gratuidade']['transactionValue'],
      ).toEqual(0);
    });

    it('should count and transactionValueSum match sum of transactionType properties', async () => {
      // Arrange
      const revenues: ITicketRevenue[] = [];
      for (let day = 3; day >= 1; day--) {
        let i = 3;
        let dayStr = day.toString().padStart(2, '0');
        let hourStr = (i * 2).toString().padStart(2, '0');
        revenues.push({
          partitionDate: `2023-06-${dayStr}`,
          processingHour: i,
          transportType: i.toString(),
          transactionId: i.toString(),
          paymentMediaType: `media_${i}`,
          transportIntegrationType: `integration_${i}`,
          transactionType: `Gratuidade`,
          transactionDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          transactionValue: 0,
          transactionLat: i,
          transactionLon: i,
          vehicleId: i.toString(),
          permitCode: `permitCode_1`,
          // Extra fields
          clientId: `clientId_${i}`,
          integrationId: i.toString(),
          processingDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          captureDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          vehicleService: i.toString(),
          directionId: i,
          stopId: i,
          stopLat: i,
          stopLon: i,
          bqDataVersion: i.toString(),
        });
        i = 2;
        dayStr = day.toString().padStart(2, '0');
        hourStr = (i * 2).toString().padStart(2, '0');
        revenues.push({
          partitionDate: `2023-06-${dayStr}`,
          processingHour: i,
          transportType: i.toString(),
          transactionId: i.toString(),
          paymentMediaType: `media_${i}`,
          transportIntegrationType: `integration_${i}`,
          transactionType: `Integral`,
          transactionDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          transactionValue: 0,
          transactionLat: i,
          transactionLon: i,
          vehicleId: i.toString(),
          permitCode: `permitCode_1`,
          // Extra fields
          clientId: `clientId_${i}`,
          integrationId: i.toString(),
          processingDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          captureDateTime: `2023-06-${dayStr}T06:${hourStr}:00.000Z`,
          vehicleService: i.toString(),
          directionId: i,
          stopId: i,
          stopLat: i,
          stopLon: i,
          bqDataVersion: i.toString(),
        });
      }
      jest.spyOn(jaeService, 'getTicketRevenues').mockResolvedValue(revenues);
      jest.spyOn(jaeService, 'isPermitCodeExists').mockReturnValue(true);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() =>
          new Date('2023-06-03T03:30:00.000Z').valueOf(),
        );
      const user = new User();
      user.id = 1;
      user.permitCode = 'permitCode_1';
      jest.spyOn(usersService, 'getOne').mockResolvedValue(user);

      // Act
      const result = await ticketRevenuesService.getMeGroupedFromUser(
        {
          startDate: '2023-06-01',
          endDate: '2023-06-01',
          userId: 1,
        },
        'ticket-revenues',
      );

      // Assert
      const transactionTypeCountsSum = Object.values(
        result.transportTypeCounts,
      ).reduce((sum, i) => sum + i.count, 0);
      const expectedTransactionValueSum = Object.values(
        result.transportTypeCounts,
      ).reduce((sum, i) => sum + i.transactionValue, 0);
      expect(result.count).toEqual(transactionTypeCountsSum);
      expect(result.transactionValueSum).toEqual(expectedTransactionValueSum);
    });
  });
});
