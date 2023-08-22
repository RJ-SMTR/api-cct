import { Test, TestingModule } from '@nestjs/testing';
import { JaeService } from './jae.service';
import { Provider } from '@nestjs/common';
import { JaeDataService } from './data/jae-data.service';

describe('JaeService', () => {
  let jaeService: JaeService;
  let jaeDataService: JaeDataService;

  beforeEach(async () => {
    const jaeDataServiceMock = {
      provide: JaeDataService,
      useValue: {
        getTicketIncomesByValidator: jest.fn(),
        getGtfsDataByValidator: jest.fn(),
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

  describe('getGtfsDataByValidator', () => {
    it('should return mocked data when validatorId is found', async () => {
      // Arrange
      const validatorId = 'existingValidator';
      const expectedResponse = JSON.stringify({
        data: [1, 2, 3],
      });
      jest
        .spyOn(jaeDataService, 'getGtfsDataByValidator')
        .mockResolvedValueOnce(expectedResponse);

      // Assert
      const response = await jaeService.getGtfsDataByValidator(validatorId);

      // Act
      expect(response).toEqual(expectedResponse);
    });
  });

  describe('getTicketRevenuesByValidator', () => {
    it('shoud return mocked data when validatorId is found', async () => {
      // Arrange
      const validatorId = 'existingValidator';
      const expectedResponse = JSON.stringify({
        data: [1, 2, 3],
      });
      jest
        .spyOn(jaeDataService, 'getTicketRevenuesByValidator')
        .mockResolvedValueOnce(expectedResponse);

      // Assert
      const response = await jaeService.getTicketRevenuesByValidator(
        validatorId,
      );

      // Act
      expect(response).toEqual(expectedResponse);
    });
  });
});
