import { Test, TestingModule } from '@nestjs/testing';
import { CoreBankDataService } from './core-bank-data.service';

describe('CoreBankDataService', () => {
  let coreBankDataService: CoreBankDataService;

  beforeEach(async () => {
    // weekday = 5
    jest
      .spyOn(global.Date, 'now')
      .mockImplementation(() => new Date('2023-01-06').valueOf());

    const module: TestingModule = await Test.createTestingModule({
      providers: [CoreBankDataService],
    }).compile();

    coreBankDataService = module.get<CoreBankDataService>(CoreBankDataService);
  });

  it('should be defined', () => {
    expect(coreBankDataService).toBeDefined();
  });

  it('should return bank statements list when successfull', () => {
    // Arrange
    function setDate(date: string) {
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date(date).valueOf());
    }

    // Act
    // Weekday = 5 Friday
    setDate('2023-10-20');
    const result_5_friday = coreBankDataService.getBankStatements();
    // Weekday = 6 Saturnday
    setDate('2023-10-14');
    const resultWithNextWeekFrom = coreBankDataService.getBankStatements();
    // Weekday = 4 Thursday
    setDate('2023-10-19');
    const resultWithNextWeekTo = coreBankDataService.getBankStatements();
    // Weekday = 2 Tuesday
    setDate('2023-10-31');
    const resultNoNextWeek = coreBankDataService.getBankStatements();

    setDate('2023-10-24');
    const resultWithNextWeekTemp = coreBankDataService.getBankStatements();

    // Assert
    expect(result_5_friday?.[0]?.date).toEqual('2023-10-20');
    expect(result_5_friday?.[1]?.date).toEqual('2023-10-13');
    expect(result_5_friday?.[2]?.date).toEqual('2023-10-06');
    expect(result_5_friday?.[3]?.date).toEqual('2023-09-29');

    expect(resultWithNextWeekFrom).toEqual(result_5_friday);
    expect(resultWithNextWeekTo).toEqual(result_5_friday);

    expect(resultWithNextWeekTemp?.[0]?.date).toEqual('2023-10-27');
    expect(resultWithNextWeekTemp?.[1]?.date).toEqual('2023-10-20');
    expect(resultWithNextWeekTemp?.[2]?.date).toEqual('2023-10-13');
    expect(resultWithNextWeekTemp?.[3]?.date).toEqual('2023-10-06');
    expect(resultWithNextWeekTemp?.[4]?.date).toEqual('2023-09-29');

    expect(resultNoNextWeek?.[0]?.date).toEqual('2023-10-27');
    expect(resultNoNextWeek?.[1]?.date).toEqual('2023-10-20');
    expect(resultNoNextWeek?.[2]?.date).toEqual('2023-10-13');
    expect(resultNoNextWeek?.[3]?.date).toEqual('2023-10-06');
    expect(resultNoNextWeek?.[4]?.date).toEqual('2023-09-29');
  });
});
