import { Test, TestingModule } from '@nestjs/testing';
import { CoreBankService } from './core-bank.service';
import { Provider } from '@nestjs/common';
import { CoreBankDataService } from './data/core-bank-data.service';

describe('CoreBankService', () => {
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

    jest.spyOn(coreBankDataService, 'getProfiles').mockReturnValue(
      JSON.stringify({
        data: [
          {
            id: '1',
            cpf: 'cpf1',
            banco: 1,
            agencia: 'a1',
            dvAgencia: 'dva1',
            conta: 'c1',
            dvConta: 'dvc1',
            cnpj: 'cnpj1',
            ente: 'ente1',
          },
          {
            id: '2',
            cpf: 'cpf2',
            banco: 2,
            agencia: 'a2',
            dvAgencia: 'dva2',
            conta: 'c2',
            dvConta: 'dvc1',
            cnpj: 'cnpj2',
            ente: 'ente2',
          },
        ],
      }),
    );

    jest.spyOn(coreBankDataService, 'getBankStatements').mockReturnValue(
      JSON.stringify({
        cpf: {
          cpf1: {
            data: [
              {
                id: 1,
                data: '2023-01-01',
                cpf: 'cpf1',
                valor: 111.11,
                status: 'sucesso',
              },
              {
                id: 2,
                data: '2023-01-08',
                cpf: 'cpf1',
                valor: 222.11,
                status: 'falha',
              },
              {
                id: 3,
                data: '2023-01-15',
                cpf: 'cpf1',
                valor: 333.11,
                status: 'sucesso',
              },
            ],
          },
          cpf2: {
            data: [
              {
                id: 1,
                data: '2023-01-15',
                cpf: 'cpf2',
                valor: 111.22,
                status: 'sucesso',
              },
              {
                id: 2,
                data: '2023-01-14',
                cpf: 'cpf2',
                valor: 222.22,
                status: 'falha',
              },
              {
                id: 3,
                data: '2023-01-13',
                cpf: 'cpf2',
                valor: 333.22,
                status: 'sucesso',
              },
            ],
          },
        },
      }),
    );
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
      const profiles = JSON.parse(coreBankDataService.getProfiles());
      const expectedResult = {
        id: profiles.data[0].id,
        cpfCnpj: profiles.data[0].cpf,
        bankCode: profiles.data[0].banco,
        bankAgencyName: profiles.data[0].ente,
        bankAgencyCode: profiles.data[0].agencia,
        bankAgencyDigit: profiles.data[0].dvAgencia,
        bankAgencyCnpj: profiles.data[0].cnpj,
        bankAccountCode: profiles.data[0].conta,
        bankAccountDigit: profiles.data[0].dvConta,
      };
      const cpf = 'cpf1';

      // Act
      const result = await coreBankService.getProfileByCpfCnpj(cpf);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should throw exception when no profile found', async () => {
      // Arrange
      const cpf = 'inexistent-cpf';

      // Assert
      await expect(
        coreBankService.getProfileByCpfCnpj(cpf),
      ).rejects.toThrowError();
    });
  });

  describe('getBankStatementsByCpfCnpj', () => {
    it("should return profile's bank statements when profile exists", () => {
      // Arrange
      const profiles = JSON.parse(coreBankDataService.getBankStatements());
      const cpf = 'cpf1';
      const expectedResult = JSON.stringify(profiles.cpf[cpf]);

      // Act
      const result = coreBankService.getBankStatementsByCpfCnpj(cpf);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should return null when no profile found', async () => {
      // Arrange
      const cpf = 'inexistent-cpf';

      // Assert
      await expect(
        coreBankService.getBankStatementsByCpfCnpj(cpf),
      ).resolves.toBeNull();
    });
  });
});
