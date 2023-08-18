import { Test, TestingModule } from '@nestjs/testing';
import { BankStatementsController } from './bank-statements.controller';
import { BankStatementsService } from './bank-statements.service';
import { Provider } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { BankStatementsInterface } from './interfaces/bank-statements.interface';
import { Request } from 'express';
import { User } from 'src/users/entities/user.entity';
import { BankStatementsGetDto } from './dto/bank-statements-get.dto';

describe('BankStatementsController', () => {
  let bankStatementsController: BankStatementsController;
  let bankStatementsService: BankStatementsService;
  let usersService: UsersService;

  beforeEach(async () => {
    const usersServiceMock = {
      provide: UsersService,
      useValue: {
        getOneFromRequest: jest.fn(),
      },
    } as Provider;
    const bankStatementsServiceMock = {
      provide: BankStatementsService,
      useValue: {
        getBankStatementsFromUser: jest.fn(),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BankStatementsController],
      providers: [bankStatementsServiceMock, usersServiceMock],
    }).compile();

    bankStatementsController = module.get<BankStatementsController>(
      BankStatementsController,
    );
    bankStatementsService = module.get<BankStatementsService>(
      BankStatementsService,
    );
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(bankStatementsController).toBeDefined();
  });

  describe('getBankStatementsFromUser', () => {
    it('should return bank statements list when profile found', async () => {
      // Arrange
      const user = {
        id: 1,
        cpfCnpj: 'cpf1',
      } as User;
      const request = {
        user: {
          id: user.id,
        },
      } as unknown as Request;
      const args = {} as BankStatementsGetDto;
      const bankStatements = [
        {
          id: 1,
          date: '2023-01-01',
          cpfCnpj: 'cpf1',
          amount: 111.11,
          status: 'sucesso',
        },
        {
          id: 2,
          date: '2023-01-08',
          cpfCnpj: 'cpf1',
          amount: 222.11,
          status: 'falha',
        },
        {
          id: 3,
          date: '2023-01-15',
          cpfCnpj: 'cpf1',
          amount: 333.11,
          status: 'sucesso',
        },
        {
          id: 4,
          date: '2023-01-22',
          cpfCnpj: 'cpf1',
          amount: 333.11,
          status: 'sucesso',
        },
      ] as BankStatementsInterface[];
      jest
        .spyOn(bankStatementsService, 'getBankStatementsFromUser')
        .mockResolvedValueOnce(bankStatements);
      jest.spyOn(usersService, 'getOneFromRequest').mockResolvedValueOnce(user);

      // Act
      const result = await bankStatementsController.getBankStatementsFromUser(
        request,
        args,
      );

      // Assert
      expect(result).toEqual(bankStatements);
    });
    it('should throw an exception when user is not found', async () => {
      // Arrange
      const inexistentUser = {
        id: 99,
      } as User;
      const request = {
        user: {
          id: inexistentUser.id,
        },
      } as unknown as Request;
      const args = {} as BankStatementsGetDto;
      jest
        .spyOn(bankStatementsService, 'getBankStatementsFromUser')
        .mockRejectedValueOnce(new Error());
      jest
        .spyOn(usersService, 'getOneFromRequest')
        .mockResolvedValueOnce(inexistentUser);

      // Assert
      await expect(
        bankStatementsController.getBankStatementsFromUser(request, args),
      ).rejects.toThrowError();
    });
  });
});
