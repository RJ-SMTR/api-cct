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
    const args = (jaeDataService as any).getTicketRevenuesArgs();
    args.minutesInterval = 10;
    args.startHour = 6;
    args.endHour = 8;
    jest
      .spyOn(jaeDataService as any, 'getTicketRevenuesArgs')
      .mockReturnValueOnce(args);
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
      const passValidatorId = (jaeDataService as any).getTicketRevenuesArgs()
        .licenseeProfiles[0].validador;
      jest
        .spyOn(jaeDataService as any, 'getStopTimes')
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
      expect(data[0].dataHora).toEqual('2023-06-30T06:10:00.000Z');
      expect(data[1].dataHora).toEqual('2023-06-30T06:00:00.000Z');
      expect(data[2].dataHora).toEqual('2023-06-29T08:00:00.000Z');
    }, 10000);

    it('should return an empty list when validator is not found', async () => {
      // Arrange
      const passValidatorId = 'inexistent-validator-id';
      jest
        .spyOn(jaeDataService as any, 'getStopTimes')
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
      const passValidatorId = (jaeDataService as any).getTicketRevenuesArgs()
        .licenseeProfiles[0].validador;
      jest
        .spyOn(jaeDataService as any, 'getStopTimes')
        .mockResolvedValueOnce(stopTimesList);
      const mockDate = (dateString: string) =>
        jest
          .spyOn(global.Date, 'now')
          .mockImplementation(() => new Date(dateString).valueOf());
      const getResult = async () => {
        try {
          return JSON.parse(
            await jaeDataService.getTicketRevenuesByValidator(passValidatorId),
          ).data;
        } catch (error) {
          return error;
        }
      };

      // Act
      mockDate('2023-06-30T06:10:00.000Z');
      const result_06_10 = await getResult();
      mockDate('2023-06-30T06:15:00.000Z');
      const result_06_15 = await getResult();
      mockDate('2023-06-30T06:20:00.000Z');
      const result_06_20 = await getResult();

      // Assert
      expect(typeof result_06_10 !== 'undefined').toBeTruthy();
      expect(typeof result_06_15 !== 'undefined').toBeTruthy();
      expect(typeof result_06_20 !== 'undefined').toBeTruthy();
      expect(result_06_10[0].dataHora).toEqual('2023-06-30T06:10:00.000Z');
      expect(result_06_15[0].dataHora).toEqual('2023-06-30T06:10:00.000Z');
      expect(result_06_20[0].dataHora).toEqual('2023-06-30T06:20:00.000Z');
    }, 10000);
  });

  describe('getVehicleDataByValidator', () => {
    it('should return a list when validator is found', async () => {
      // Arrange
      const expectedResponseKeys = new Set(['data', 'passValidatorId']);
      const expectedDataKeys = new Set(['trip', 'stopTimes']);
      const passValidatorId = (jaeDataService as any).getTicketRevenuesArgs()
        .licenseeProfiles[0].validador;
      jest
        .spyOn(jaeDataService as any, 'getStopTimes')
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
        .spyOn(jaeDataService as any, 'getStopTimes')
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
