import { Test, TestingModule } from '@nestjs/testing';
import { JaeDataService } from './jae-data.service';
import { HttpModule } from '@nestjs/axios';
import { readFileSync } from 'fs';

const stopTimesList = JSON.parse(
  readFileSync(__dirname + '/test/stopTimes.txt', { encoding: 'utf-8' }),
);

describe('JaeDataService', () => {
  let jaeDataService: JaeDataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [JaeDataService],
    }).compile();
    jaeDataService = module.get<JaeDataService>(JaeDataService);
    jest
      .spyOn(global.Date, 'now')
      .mockImplementation(() => new Date('2023-06-30T06:10:00.000Z').valueOf());
  });

  it('should be defined', () => {
    expect(jaeDataService).toBeDefined();
  });

  describe('getTicketRevenuesByValidator', () => {
    it('should return a list when validator is found', async () => {
      // Arrange
      const expectedDataKeys = new Set([
        'codigo',
        'validador',
        'placa',
        'dataHora',
        'valor',
        'latitude',
        'longitude',
        'transacoes',
      ]);
      const passValidatorId =
        jaeDataService._getTicketRevenuesArgs().licenseeProfiles[0].validador;
      jest
        .spyOn(jaeDataService, '_getStopTimes')
        .mockResolvedValueOnce(stopTimesList);

      // Act
      const result = await jaeDataService.getTicketRevenuesByValidator(
        passValidatorId,
      );
      let resultValidJson: any = undefined;
      try {
        resultValidJson = JSON.parse(result);
      } catch (error) {}

      // Assert
      expect(typeof resultValidJson === 'object').toBeTruthy();
      const data = resultValidJson?.data;
      expect(Array.isArray(data)).toBeTruthy();
      expect(data.length).toBeGreaterThan(0);
      expect(new Set(Object.keys(data?.[0]))).toMatchObject(expectedDataKeys);
    }, 10000);

    it('should return an empty list when validator is not found', async () => {
      // Arrange
      const passValidatorId = 'inexistent-validator-id';
      jest
        .spyOn(jaeDataService, '_getStopTimes')
        .mockResolvedValueOnce(stopTimesList);

      // Act
      const result = await jaeDataService.getTicketRevenuesByValidator(
        passValidatorId,
      );
      let resultValidJson: any = undefined;
      try {
        resultValidJson = JSON.parse(result);
      } catch (error) {}

      // Assert
      expect(typeof resultValidJson === 'object').toBeTruthy();
      const response = resultValidJson?.data;
      expect(Array.isArray(response)).toBeTruthy();
      expect(response.length).toEqual(0);
    }, 10000);

    it('should update list when time passes', async () => {
      // Arrange
      const passValidatorId =
        jaeDataService._getTicketRevenuesArgs().licenseeProfiles[0].validador;
      const args = jaeDataService._getTicketRevenuesArgs();
      args.minutesInterval = 10;
      args.startHour = 6;
      args.endHour = 14;
      jest
        .spyOn(jaeDataService, '_getTicketRevenuesArgs')
        .mockReturnValueOnce(args);
      jest
        .spyOn(jaeDataService, '_getStopTimes')
        .mockResolvedValueOnce(stopTimesList);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() =>
          new Date('2023-06-30T06:10:00.000Z').valueOf(),
        );

      // Act
      const result = await jaeDataService.getTicketRevenuesByValidator(
        passValidatorId,
      );
      let resultValidJson: any = undefined;
      try {
        resultValidJson = JSON.parse(result);
      } catch (error) {}

      // Assert
      expect(typeof resultValidJson === 'object').toBeTruthy();
      const data = resultValidJson?.data?.slice(0, 3);
      expect(typeof data !== 'undefined').toBeTruthy();
    }, 10000);
  });

  describe('getVehicleDataByValidator', () => {
    it('should return a list when validator is found', async () => {
      // Arrange
      const expectedResponseKeys = new Set(['data', 'passValidatorId']);
      const expectedDataKeys = new Set(['trip', 'stopTimes']);
      const passValidatorId =
        jaeDataService._getTicketRevenuesArgs().licenseeProfiles[0].validador;
      jest
        .spyOn(jaeDataService, '_getStopTimes')
        .mockResolvedValueOnce(stopTimesList);

      // Act
      const result = await jaeDataService.getGtfsDataByValidator(
        passValidatorId,
      );
      let resultValidJson: any = undefined;
      try {
        resultValidJson = JSON.parse(result);
      } catch (error) {}

      // Assert
      expect(typeof resultValidJson === 'object').toBeTruthy();
      const response = resultValidJson?.data;
      expect(Array.isArray(response)).toBeTruthy();
      expect(response.length).toBeGreaterThan(0);
      expect(new Set(Object.keys(response[0]))).toMatchObject(
        expectedResponseKeys,
      );
      const data = response[0].data;
      expect(data.length).toBeGreaterThan(0);
      expect(new Set(Object.keys(data[0]))).toMatchObject(expectedDataKeys);
      expect(data[0].stopTimes.length).toBeGreaterThan(0);
    }, 10000);

    it('should return an empty list when validator is not found', async () => {
      // Arrange
      const passValidatorId = 'inexistent-validator-id';
      jest
        .spyOn(jaeDataService, '_getStopTimes')
        .mockResolvedValueOnce(stopTimesList);

      // Act
      const result = await jaeDataService.getGtfsDataByValidator(
        passValidatorId,
      );
      let resultValidJson: any = undefined;
      try {
        resultValidJson = JSON.parse(result);
      } catch (error) {}

      // Assert
      expect(typeof resultValidJson === 'object').toBeTruthy();
      const response = resultValidJson?.data;
      expect(Array.isArray(response)).toBeTruthy();
      expect(response.length).toEqual(0);
    }, 10000);
  });
});
