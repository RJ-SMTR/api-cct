import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { ICoreBankStatements } from 'src/core-bank/interfaces/core-bank-statements.interface';
import { User } from 'src/users/entities/user.entity';
import { BankStatementsService } from './bank-statements.service';
import { IBankStatementsGet } from './interfaces/bank-statements-get.interface';

const allBankStatements = [
  { id: 0, cpfCnpj: 'cpfCnpj_1', date: '2023-01-27', amount: 1 },
  { id: 1, cpfCnpj: 'cpfCnpj_1', date: '2023-01-20', amount: 2 },
  { id: 2, cpfCnpj: 'cpfCnpj_1', date: '2023-01-13', amount: 3 },
  { id: 3, cpfCnpj: 'cpfCnpj_1', date: '2023-01-06', amount: 4 },
] as Partial<ICoreBankStatements>[] as ICoreBankStatements[];

describe('BankStatementsService', () => {
  let bankStatementsService: BankStatementsService;
  let coreBankService: CoreBankService;

  beforeEach(async () => {
    const coreBankServiceMock = {
      provide: CoreBankService,
      useValue: {
        getBankStatementsByCpfCnpj: jest.fn(),
        getBankStatementsMocked: jest.fn(),
        getProfileByCpfCnpj: jest.fn(),
        update: jest.fn().mockReturnValue(undefined),
      },
    } as Provider;

    const module: TestingModule = await Test.createTestingModule({
      providers: [BankStatementsService, coreBankServiceMock],
    }).compile();

    bankStatementsService = module.get<BankStatementsService>(
      BankStatementsService,
    );
    coreBankService = module.get<CoreBankService>(CoreBankService);
  });

  it('should be defined', () => {
    expect(bankStatementsService).toBeDefined();
    expect(coreBankService).toBeDefined();
  });

  describe('getBankStatementsFromUser', () => {
    it('should return statements for previous days when user fetched successfully', () => {
      // Arrange
      const args = {
        timeInterval: 'last2Weeks',
        userId: 1,
      } as IBankStatementsGet;

      const expectedResult = {
        amountSum: 6,
        data: allBankStatements.slice(0, 3),
      };

      jest
        .spyOn(coreBankService, 'getBankStatementsMocked')
        .mockReturnValue(allBankStatements);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-22').valueOf());

      // Act
      const result = bankStatementsService.getBankStatementsFromUser(args);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should return statements between dates when user fetched successfully', () => {
      // Arrange
      const user = {
        cpfCnpj: allBankStatements[0].cpfCnpj,
      } as User;
      const args = {
        startDate: '2023-01-06',
        endDate: '2023-01-13',
        userId: 1,
      } as IBankStatementsGet;

      const bankStatementsByCpf = allBankStatements.filter(
        (i) => i.cpfCnpj === user.cpfCnpj,
      );
      const expectedResult = {
        amountSum: 7,
        data: bankStatementsByCpf.slice(2, 4),
      };

      jest
        .spyOn(coreBankService, 'getBankStatementsMocked')
        .mockReturnValueOnce(bankStatementsByCpf);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-22').valueOf());

      // Act
      const result = bankStatementsService.getBankStatementsFromUser(args);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should throw exception when profile is not found', () => {
      // Arrange
      const user = {
        cpfCnpj: 'inexistent-cpf',
      } as User;
      const args = {
        previousDays: 14,
      } as IBankStatementsGet;

      jest
        .spyOn(coreBankService, 'getBankStatementsByCpfCnpj')
        .mockReturnValueOnce([]);

      // Assert
      expect(() =>
        bankStatementsService.getBankStatementsFromUser(user, args),
      ).toThrowError();
    });
  });
});
