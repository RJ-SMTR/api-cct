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
    // Act
    const result = coreBankDataService.getBankStatements();

    // Assert
    expect(result?.[0]?.date).toEqual('2023-01-13');
    expect(result?.[1]?.date).toEqual('2023-01-06');
  });
});
