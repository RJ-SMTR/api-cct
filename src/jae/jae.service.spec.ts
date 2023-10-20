import { Test, TestingModule } from '@nestjs/testing';
import { JaeService } from './jae.service';
import { Provider } from '@nestjs/common';
import { JaeDataService } from './data/jae-data.service';
import { IJaeTicketRevenue } from './interfaces/jae-ticket-revenue.interface';
import { JaeProfileInterface } from './interfaces/jae-profile.interface';

describe('JaeService', () => {
  let jaeService: JaeService;
  let jaeDataService: JaeDataService;

  beforeEach(async () => {
    const jaeDataServiceMock = {
      provide: JaeDataService,
      useValue: {
        getTicketRevenuesByPermitCode: jest.fn(),
        getGtfsDataByValidator: jest.fn(),
        getProfiles: jest.fn(),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      providers: [JaeService, jaeDataServiceMock],
    }).compile();

    jaeService = module.get<JaeService>(JaeService);
    jaeDataService = module.get<JaeDataService>(JaeDataService);
  });

  it('should be defined', () => {
    expect(jaeService).toBeDefined();
  });

  describe('getProfileByPermitCode', () => {
    it('should return mocked data when validatorId is found', () => {
      // Arrange
      const profiles = [
        {
          id: 0,
          permitCode: 'permitCode_1',
          passValidatorId: 'passValidatorId_1',
          vehiclePlate: 'plate_1',
        },
        {
          id: 1,
          permitCode: 'permitCode_2',
          passValidatorId: 'passValidatorId_2',
          vehiclePlate: 'plate_2',
        },
      ] as JaeProfileInterface[];
      const permitCode = profiles[0].permitCode;
      jest.spyOn(jaeDataService, 'getProfiles').mockReturnValueOnce(profiles);

      // Assert
      const response = jaeService.getProfileByPermitCode(permitCode);

      // Act
      expect(response).toEqual(profiles[0]);
    });
  });

  describe('getTicketRevenuesByPermitCode', () => {
    it('shoud return mocked data when validatorId is found', async () => {
      // Arrange
      const permitCode = 'permitCode_1';
      const ticketRevenues = [
        { transactionId: 0, permitCode: 'permitCode_1' },
        { transactionId: 1, permitCode: 'permitCode_2' },
      ] as IJaeTicketRevenue[];
      jest
        .spyOn(jaeDataService, 'getTicketRevenuesByPermitCode')
        .mockResolvedValueOnce(ticketRevenues);

      // Assert
      const response = await jaeService.getTicketRevenuesByPermitCode(
        permitCode,
      );

      // Act
      expect(response).toEqual(ticketRevenues);
    });
  });
});
