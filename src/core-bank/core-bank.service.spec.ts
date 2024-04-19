import { Test, TestingModule } from '@nestjs/testing';
import { CoreBankService } from './core-bank.service';
import { Provider } from '@nestjs/common';
import { CoreBankDataService } from './data/core-bank-data.service';
import { ICoreBankStatements } from './interfaces/core-bank-statements.interface';
import { ICoreBankProfile } from './interfaces/core-bank-profile.interface';

const coreBankProfiles: ICoreBankProfile[] = [
  {
    id: 1,
    cpfCnpj: 'cpfCnpj_1',
    bankCode: 1,
    bankAgencyCode: 'bankAgencyCode_1',
    bankAgencyDigit: 'bankAgencyDigit_1',
    bankAccountCode: 'bankAccountCode_1',
    bankAccountDigit: 'bankAccountDigit_1',
    rg: 'rg_1',
    bankAgencyName: 'bankAgencyName_1',
  },
  {
    id: 2,
    cpfCnpj: 'cpfCnpj_2',
    bankCode: 2,
    bankAgencyCode: 'bankAgencyCode_2',
    bankAgencyDigit: 'bankAgencyDigit_2',
    bankAccountCode: 'bankAccountCode_2',
    bankAccountDigit: 'bankAccountDigit_2',
    rg: 'rg_2',
    bankAgencyName: 'bankAgencyName_2',
  },
] as ICoreBankProfile[];

const bankStatements = [] as ICoreBankStatements[];
const firstFriday_2023_01 = 6;
for (let cpfIndex = 0; cpfIndex < 2; cpfIndex++) {
  const cpf = `cpfCnpj_${cpfIndex}`;
  for (let week = 0; week < 3; week++) {
    bankStatements.push({
      id: cpfIndex * 3 + week,
      amount: week * 10,
      cpfCnpj: cpf,
      date: `2023-01-${firstFriday_2023_01 + week * 7}`,
      status: week % 2 ? 'sucesso' : 'falha',
    } as ICoreBankStatements);
  }
}

xdescribe('CoreBankService', () => {
  let coreBankService: CoreBankService;
  let coreBankDataService: CoreBankDataService;

  beforeEach(async () => {
    const coreBankDataServiceMock = {
      provide: CoreBankDataService,
      useValue: {
        getProfiles: jest.fn(),
        getBankStatements: jest.fn(),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoreBankService, coreBankDataServiceMock],
    }).compile();

    coreBankService = module.get<CoreBankService>(CoreBankService);
    coreBankDataService = module.get<CoreBankDataService>(CoreBankDataService);

    jest
      .spyOn(coreBankDataService, 'getProfiles')
      .mockReturnValue(coreBankProfiles);
    jest
      .spyOn(coreBankDataService, 'getBankStatements')
      .mockReturnValue(bankStatements);
    jest
      .spyOn(global.Date, 'now')
      .mockImplementation(() => new Date('2023-01-15').valueOf());
  });

  it('should be defined', () => {
    expect(coreBankService).toBeDefined();
  });

  describe('getProfileByCpfCnpj', () => {
    it('should return matched profile when exists', async () => {
      // Arrange
      const profiles = coreBankDataService.getProfiles();
      const expectedResult = profiles[0];
      const cpf = expectedResult.cpfCnpj;

      // Act
      const result = await coreBankService.getProfileByPermitCode(cpf);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should throw exception when no profile found', async () => {
      // Arrange
      const cpf = 'inexistent-cpf';

      // Assert
      await expect(
        coreBankService.getProfileByPermitCode(cpf),
      ).rejects.toThrowError();
    });
  });

  describe('getBankStatementsByCpfCnpj', () => {
    it("should return profile's bank statements when profile exists", () => {
      // Arrange
      const cpfCnpj = 'cpfCnpj_1';
      const statements = coreBankDataService.getBankStatements();
      const expectedResult = statements.filter((i) => i.cpfCnpj === cpfCnpj);

      // Act
      const result = coreBankService.getBankStatementsByPermitCode(cpfCnpj);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should return null when no profile found', () => {
      // Arrange
      const cpf = 'inexistent-cpf';

      // Act
      const response = coreBankService.getBankStatementsByPermitCode(cpf);

      // Assert
      expect(response.length).toEqual(0);
    });
  });
});
