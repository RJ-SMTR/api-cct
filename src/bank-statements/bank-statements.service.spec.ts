import { Test, TestingModule } from '@nestjs/testing';
import { BankStatementsService } from './bank-statements.service';
import { Provider } from '@nestjs/common';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { User } from 'src/users/entities/user.entity';
import { BankStatementsGetDto } from './dto/bank-statements-get.dto';

const bankStatements = {
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
        {
          id: 4,
          data: '2023-01-22',
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
          data: '2023-01-01',
          cpf: 'cpf2',
          valor: 111.22,
          status: 'sucesso',
        },
      ],
    },
  },
};

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
    it('should return statements for previous days when user fetched successfully', async () => {
      // Arrange
      const user = {
        cpfCnpj: 'cpf1',
      } as User;
      const args = {
        previousDays: 14,
      } as BankStatementsGetDto;

      jest
        .spyOn(coreBankService, 'getBankStatementsByCpfCnpj')
        .mockReturnValueOnce(
          JSON.stringify(bankStatements.cpf[user.cpfCnpj as string]),
        );
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-22').valueOf());
      const expectedResult = bankStatements.cpf[user.cpfCnpj as string].data
        .slice(1, 4)
        .map((item) => ({
          id: item.id,
          date: item.data,
          cpfCnpj: item.cpf,
          amount: item.valor,
          status: item.status,
        }));

      // Act
      const result = await bankStatementsService.getBankStatementsFromUser(
        user,
        args,
      );

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should return statements between dates when user fetched successfully', async () => {
      // Arrange
      const user = {
        cpfCnpj: 'cpf1',
      } as User;
      const args = {
        startDate: '2023-01-08',
        endDate: '2023-01-15',
      } as BankStatementsGetDto;

      jest
        .spyOn(coreBankService, 'getBankStatementsByCpfCnpj')
        .mockReturnValueOnce(
          JSON.stringify(bankStatements.cpf[user.cpfCnpj as string]),
        );
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-22').valueOf());
      const expectedResult = bankStatements.cpf[user.cpfCnpj as string].data
        .slice(1, 3)
        .map((item) => ({
          id: item.id,
          date: item.data,
          cpfCnpj: item.cpf,
          amount: item.valor,
          status: item.status,
        }));

      // Act
      const result = await bankStatementsService.getBankStatementsFromUser(
        user,
        args,
      );

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should throw exception when profile is not found', async () => {
      // Arrange
      const user = {
        cpfCnpj: 'inexistent-cpf',
      } as User;
      const args = {
        previousDays: 14,
      } as BankStatementsGetDto;
      jest
        .spyOn(coreBankService, 'getBankStatementsByCpfCnpj')
        .mockReturnValueOnce(null);

      // Assert
      await expect(
        bankStatementsService.getBankStatementsFromUser(user, args),
      ).rejects.toThrowError();
    });
  });
});
