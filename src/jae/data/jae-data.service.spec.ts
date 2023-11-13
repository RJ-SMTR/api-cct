import { HttpModule } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { IFetchTicketRevenues } from 'src/ticket-revenues/interfaces/fetch-ticket-revenues.interface';
import { JaeDataService } from './jae-data.service';

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
    args.minutesInterval = 30;
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

  /**
   * @see {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 Requirements - GitHub}
   */
  describe('setTicketRevenues', () => {
    it('should return Gratuidade = R$ 0.00', async () => {
      // Act
      jaeDataService['setTicketRevenues']();
      const generatedData = await jaeDataService.getTicketRevenues({
        permitCode: '213890329890312',
      });

      // Assert
      const gratuidade = generatedData.filter(
        (i) => i.transactionType === 'Gratuidade',
      );
      const gratuidadeSum = gratuidade.reduce(
        (sum, i) => sum + (i.transactionValue || 0),
        0,
      );
      expect(gratuidade.length).toBeGreaterThan(0);
      expect(gratuidadeSum).toEqual(0);
    });

    it('should return Integração = 50% of ticket value', async () => {
      // Arrange
      const ticketValue =
        jaeDataService['getTicketRevenuesArgs']()['ticketTransactionValue'];

      // Act
      jaeDataService['setTicketRevenues']();
      const generatedData = await jaeDataService.getTicketRevenues({
        permitCode: '213890329890312',
      });

      // Assert
      const integracao = generatedData.filter(
        (i) => i.transactionType === 'Integração',
      );
      const integracaoSum = Number(
        integracao
          .reduce((sum, i) => sum + (i.transactionValue || 0), 0)
          .toFixed(2),
      );
      const expectedSum = Number(
        ((ticketValue * integracao.length) / 2).toFixed(2),
      );

      expect(integracao.length).toBeGreaterThan(0);
      expect(integracaoSum).toEqual(expectedSum);
    });

    it('should return Integral = 100% of ticket value', async () => {
      // Arrange
      const ticketValue =
        jaeDataService['getTicketRevenuesArgs']()['ticketTransactionValue'];

      // Act
      jaeDataService['setTicketRevenues']();
      const generatedData = await jaeDataService.getTicketRevenues({
        permitCode: '213890329890312',
      });

      // Assert
      const inteira = generatedData.filter(
        (i) => i.transactionType === 'Integral',
      );
      const inteiraSum = Number(
        inteira
          .reduce((sum, i) => sum + (i.transactionValue || 0), 0)
          .toFixed(2),
      );
      const expectedSum = Number((ticketValue * inteira.length).toFixed(2));

      expect(inteira.length).toBeGreaterThan(0);
      expect(inteiraSum).toEqual(expectedSum);
    });
  });

  // TODO: Update tests
  describe('getTicketRevenues', () => {
    // it('should return a list when validator is found', async () => {
    //   // Arrange
    //   const permitCode = (jaeDataService as any).getTicketRevenuesArgs()
    //     .jaeProfiles[0].permitCode;
    //   jest
    //     .spyOn(jaeDataService as any, 'getStopTimes')
    //     .mockResolvedValueOnce(stopTimesList);

    //   // Act
    //   const result = await jaeDataService.getTicketRevenues(permitCode);

    //   // Assert
    //   expect(typeof permitCode !== 'undefined').toBeTruthy();
    //   expect((jaeDataService as any).ticketRevenues.length).toBeGreaterThan(0);
    //   expect(Array.isArray(result)).toBeTruthy();
    //   expect(result.length).toBeGreaterThan(0);
    //   const filteredResult = [
    //     result.find(
    //       (i) => i.transactionDateTime === '2023-06-30T06:10:00.000Z',
    //     ),
    //     result.find(
    //       (i) => i.transactionDateTime === '2023-06-30T06:00:00.000Z',
    //     ),
    //     result.find(
    //       (i) => i.transactionDateTime === '2023-06-29T08:00:00.000Z',
    //     ),
    //   ];
    //   expect(filteredResult[0] !== undefined).toBeTruthy();
    //   expect(filteredResult[1] !== undefined).toBeTruthy();
    //   expect(filteredResult[2] !== undefined).toBeTruthy();
    //   expect(Number(filteredResult[0]?.transactionId)).toBeLessThan(
    //     Number(filteredResult[1]?.transactionId),
    //   );
    //   expect(Number(filteredResult[1]?.transactionId)).toBeLessThan(
    //     Number(filteredResult[2]?.transactionId),
    //   );
    // }, 10000);

    it('should return an empty list when validator is not found', async () => {
      // Arrange
      const args = {
        permitCode: 'inexistent-validator-id',
      } as IFetchTicketRevenues;
      jest
        .spyOn(jaeDataService as any, 'getStopTimes')
        .mockResolvedValueOnce(stopTimesList);

      // Act
      const result = await jaeDataService.getTicketRevenues(args);

      // Assert
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toEqual(0);
    });

    // it('should update list when time passes', async () => {
    //   // Arrange
    //   const permitCode = (jaeDataService as any).getTicketRevenuesArgs()
    //     .jaeProfiles[0].permitCode;
    //   jest
    //     .spyOn(jaeDataService as any, 'getStopTimes')
    //     .mockResolvedValueOnce(stopTimesList);
    //   const mockDate = (dateString: string) =>
    //     jest
    //       .spyOn(global.Date, 'now')
    //       .mockImplementation(() => new Date(dateString).valueOf());
    //   const getResult = async () =>
    //     await jaeDataService.getTicketRevenues(permitCode);

    //   // Act
    //   mockDate('2023-06-30T06:10:00.000Z');
    //   const result_06_10 = await getResult();
    //   mockDate('2023-06-30T06:15:00.000Z');
    //   const result_06_15 = await getResult();
    //   mockDate('2023-06-30T06:20:00.000Z');
    //   const result_06_20 = await getResult();

    //   // Assert
    //   expect(typeof permitCode !== 'undefined').toBeTruthy();
    //   expect(typeof result_06_10 !== 'undefined').toBeTruthy();
    //   expect(typeof result_06_15 !== 'undefined').toBeTruthy();
    //   expect(typeof result_06_20 !== 'undefined').toBeTruthy();
    //   expect(result_06_10[0].transactionDateTime).toEqual(
    //     '2023-06-30T06:10:00.000Z',
    //   );
    //   expect(result_06_15[0].transactionDateTime).toEqual(
    //     '2023-06-30T06:10:00.000Z',
    //   );
    //   expect(result_06_20[0].transactionDateTime).toEqual(
    //     '2023-06-30T06:20:00.000Z',
    //   );
    // });
  });

  describe('getProfiles', () => {
    it('should return jae profiles list', () => {
      // Act
      const result = jaeDataService.getProfiles();

      // Assert
      expect(Array.isArray(result)).toBeTruthy();
    });
  });
});
