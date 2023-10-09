import { Test, TestingModule } from '@nestjs/testing';
import { BankStatementsService } from './bank-statements.service';
import { Provider } from '@nestjs/common';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { User } from 'src/users/entities/user.entity';
import { BankStatementsGetDto } from './dto/bank-statements-get.dto';
import { CoreBankStatementsInterface } from 'src/core-bank/interfaces/core-bank-statements.interface';

const allBankStatements = [
  { id: 0, cpfCnpj: 'cpfCnpj_1', date: '2023-01-20' },
  { id: 1, cpfCnpj: 'cpfCnpj_1', date: '2023-01-13' },
  { id: 2, cpfCnpj: 'cpfCnpj_1', date: '2023-01-06' },
] as Partial<CoreBankStatementsInterface>[] as CoreBankStatementsInterface[];

describe('BankStatementsService', () => {
  let bankStatementsService: BankStatementsService;
  let coreBankService: CoreBankService;

  beforeEach(async () => {
    const coreBankServiceMock = {
      provide: CoreBankService,
      useValue: {
        getBankStatementsByCpfCnpj: jest.fn(),
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
      const user = {
        cpfCnpj: allBankStatements[0].cpfCnpj,
      } as User;
      const args = {
        previousDays: 14,
      } as BankStatementsGetDto;

      const expectedResult = allBankStatements.slice(0, 2);

      jest
        .spyOn(coreBankService, 'getBankStatementsByCpfCnpj')
        .mockReturnValueOnce(allBankStatements);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-22').valueOf());

      // Act
      const result = bankStatementsService.getBankStatementsFromUser(
        user,
        args,
      );

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
      } as BankStatementsGetDto;

      const bankStatementsByCpf = allBankStatements.filter(
        (i) => i.cpfCnpj === user.cpfCnpj,
      );
      const expectedResult = bankStatementsByCpf.slice(1, 3);

      jest
        .spyOn(coreBankService, 'getBankStatementsByCpfCnpj')
        .mockReturnValueOnce(bankStatementsByCpf);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-22').valueOf());

      // Act
      const result = bankStatementsService.getBankStatementsFromUser(
        user,
        args,
      );

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
      } as BankStatementsGetDto;

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
