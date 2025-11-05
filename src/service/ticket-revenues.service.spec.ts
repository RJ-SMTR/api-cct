import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BigqueryService } from 'src/client/bigquery/bigquery.service';
import { UsersService } from 'src/service/users.service';
import { TicketRevenuesRepositoryService } from '../repository/ticket-revenues.repository';

import { SettingsService } from 'src/configuration/settings/settings.service';
import { User } from 'src/domain/entity/user.entity';
import { TicketRevenuesService } from './ticket-revenues.service';

describe('TicketRevenuesService', () => {
  let ticketRevenuesService: TicketRevenuesService;
  let ticketRevenuesRepository: TicketRevenuesRepositoryService;
  let usersService: UsersService;

  beforeEach(async () => {
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
    const settingsServiceMock = {
      provide: SettingsService,
      useValue: {
        getOneBySettingData: jest.fn(),
        findOneBySettingData: jest.fn(),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketRevenuesService, TicketRevenuesRepositoryService, usersServiceMock, bigqueryServiceMock, settingsServiceMock],
    }).compile();
    jest.spyOn(global.Date, 'now').mockImplementation(() => new Date('2023-06-01T06:00:00.000Z').valueOf());

    ticketRevenuesService = module.get<TicketRevenuesService>(TicketRevenuesService);
    ticketRevenuesRepository = module.get<TicketRevenuesRepositoryService>(TicketRevenuesRepositoryService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Setup tests', () => {
    test('timezone should be UTC', () => {
      expect(new Date().getTimezoneOffset()).toBe(0);
    });
  });

  it('should be defined', () => {
    expect(ticketRevenuesService).toBeDefined();
  });

  describe('getMeGroupedFromUser', () => {
    it('should return Gratuidade = R$ 0.00', /**
     * Requirement: 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item 4 - GitHub}
     */ async () => {
      // Arrange
      const revenues: ITicketRevenue[] = [];
      for (let day = 3; day >= 1; day--) {
        let i = 3;
        let dayStr = day.toString().padStart(2, '0');
        let hourStr = (i * 2).toString().padStart(2, '0');
        revenues.push({
          date: `2023-06-${dayStr}`,
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
          date: `2023-06-${dayStr}`,
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
      jest.spyOn(global.Date, 'now').mockImplementation(() => new Date('2023-06-03T03:30:00.000Z').valueOf());
      const user = new User();
      user.id = 1;
      user.cpfCnpj = 'cpfCnpj_1';
      jest.spyOn(usersService, 'getOne').mockResolvedValue(user);
      jest.spyOn(ticketRevenuesRepository as any, 'fetchTicketRevenues').mockResolvedValue({
        data: revenues,
        countAll: revenues.length,
      });

      // Act
      const result = await ticketRevenuesService.getMeGrouped({
        startDate: '2023-06-01',
        endDate: '2023-06-01',
        userId: 1,
      });

      // Assert
      expect(result.transactionTypeCounts?.['Gratuidade']['transactionValue']).toEqual(0);
    });

    it('should count and match transactionValueSum with sum of transactionType properties', /**
     * Requirement: 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item 6 - GitHub}
     */ async () => {
      // Arrange
      const revenues: ITicketRevenue[] = [];
      for (let day = 3; day >= 1; day--) {
        let i = 3;
        let dayStr = day.toString().padStart(2, '0');
        let hourStr = (i * 2).toString().padStart(2, '0');
        revenues.push({
          date: `2023-06-${dayStr}`,
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
          date: `2023-06-${dayStr}`,
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
      jest.spyOn(global.Date, 'now').mockImplementation(() => new Date('2023-06-03T03:30:00.000Z').valueOf());
      const user = new User();
      user.id = 1;
      user.cpfCnpj = 'cpfCnpj_1';
      jest.spyOn(usersService, 'getOne').mockResolvedValue(user);
      jest.spyOn(ticketRevenuesRepository as any, 'fetchTicketRevenues').mockResolvedValue({
        data: revenues,
        countAll: revenues.length,
      });

      // Act
      const result = await ticketRevenuesService.getMeGrouped({
        startDate: '2023-06-01',
        endDate: '2023-06-01',
        userId: 1,
      });

      // Assert
      const transactionTypeCountsSum = Object.values(result.transportTypeCounts).reduce((sum, i) => sum + i.count, 0);
      const expectedTransactionValueSum = Object.values(result.transportTypeCounts).reduce((sum, i) => sum + i.transactionValue, 0);
      expect(result.count).toEqual(transactionTypeCountsSum);
      expect(result.transactionValueSum).toEqual(expectedTransactionValueSum);
    });
  });
});
