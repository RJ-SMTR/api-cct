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

  // afterEach(async () => {
  //     jest.useRealTimers();
  // });

  it('should be defined', () => {
    expect(coreBankDataService).toBeDefined();
  });

  it('should return profile list when successfull', () => {
    // Assign
    let resultObject: any = {};

    // Act
    const result = coreBankDataService.getProfiles();
    try {
      resultObject = JSON.parse(result);
    } catch (error) {}

    // Assert
    const data = resultObject?.data;
    expect(Array.isArray(data)).toBeTruthy();

    expect(typeof data?.[0]?.id).toEqual('string');
    expect(typeof data?.[0]?.cpf).toEqual('string');
    expect(typeof data?.[0]?.banco).toEqual('number');
    expect(typeof data?.[0]?.agencia).toEqual('string');
    expect(typeof data?.[0]?.dvAgencia).toEqual('string');
    expect(typeof data?.[0]?.conta).toEqual('string');
    expect(typeof data?.[0]?.dvConta).toEqual('string');
    expect(typeof data?.[0]?.cnpj).toEqual('string');
    expect(typeof data?.[0]?.ente).toEqual('string');
  });

  it('should return bank statements list when successfull', () => {
    // Assign
    let resultObject: any = {};

    // Act
    const result = coreBankDataService.getBankStatements();
    try {
      resultObject = JSON.parse(result);
    } catch (error) {}

    // Assert
    const cpf = resultObject?.cpf;
    expect(typeof cpf).toBe('object');

    const cpfItem = Object.keys(cpf)?.[0];
    const resultData = cpf?.[cpfItem]?.data;
    expect(Array.isArray(resultData)).toBeTruthy();

    expect(typeof resultData?.[0]?.id).toEqual('number');
    expect(typeof resultData?.[0]?.data).toEqual('string');
    expect(typeof resultData?.[0]?.cpf).toEqual('string');
    expect(typeof resultData?.[0]?.valor).toEqual('number');
    expect(typeof resultData?.[0]?.status).toEqual('string');

    expect(resultData?.[0]?.data).toEqual('2023-01-17');
    expect(resultData?.[1]?.data).toEqual('2023-01-10');
  });
});
