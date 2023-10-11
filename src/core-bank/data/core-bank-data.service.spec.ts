import { Test, TestingModule } from '@nestjs/testing';
import { CoreBankDataService } from './core-bank-data.service';

describe('CoreBankDataService', () => {
  let coreBankDataService: CoreBankDataService;

  beforeEach(async () => {
    jest
      .spyOn(global.Date, 'now')
      .mockImplementation(() => new Date('2023-01-17').valueOf());

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
    // setDate('2023-01-19');
    // const resultThursday = coreBankDataService.getBankStatements();
    setDate('2023-01-20');
    const resultFriday = coreBankDataService.getBankStatements();

    // Assert
    // expect(resultThursday?.[0]?.date).toEqual('2023-01-19');
    // expect(resultThursday?.[1]?.date).toEqual('2023-01-18');

    console.log(resultFriday);
    expect(resultFriday?.[0]?.date).toEqual('2023-01-20');
    expect(resultFriday?.[1]?.date).toEqual('2023-01-20');
    expect(resultFriday?.[2]?.date).toEqual('2023-01-13');
    expect(resultFriday?.[3]?.date).toEqual('2023-01-06');
  });
});
