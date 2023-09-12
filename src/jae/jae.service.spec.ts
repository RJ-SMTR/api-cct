import { Test, TestingModule } from '@nestjs/testing';
import { JaeService } from './jae.service';
import { Provider } from '@nestjs/common';
import { JaeDataService } from './data/jae-data.service';
import { JaeTicketRevenueInterface } from './interfaces/jae-ticket-revenue.interface';
import { JaeProfileInterface } from './interfaces/jae-profile.interface';

describe('JaeService', () => {
  let jaeService: JaeService;
  let jaeDataService: JaeDataService;

  beforeEach(async () => {
    const jaeDataServiceMock = {
      provide: JaeDataService,
      useValue: {
        getTicketRevenuesByValidator: jest.fn(),
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
          plate: 'plate_1',
        },
        {
          id: 1,
          permitCode: 'permitCode_2',
          passValidatorId: 'passValidatorId_2',
          plate: 'plate_2',
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

  describe('getTicketRevenuesByValidator', () => {
    it('shoud return mocked data when validatorId is found', async () => {
      // Arrange
      const validatorId = 'validatorId_1';
      const ticketRevenues = [
        { id: 0, passValidatorId: 'validatorId_1' },
        { id: 1, passValidatorId: 'validatorId_2' },
      ] as JaeTicketRevenueInterface[];
      jest
        .spyOn(jaeDataService, 'getTicketRevenuesByValidator')
        .mockResolvedValueOnce(ticketRevenues);

      // Assert
      const response = await jaeService.getTicketRevenuesByValidator(
        validatorId,
      );

      // Act
      expect(response).toEqual(ticketRevenues);
    });
  });
});
