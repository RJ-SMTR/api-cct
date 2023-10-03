import { Test, TestingModule } from '@nestjs/testing';
import { BankStatementsController } from './bank-statements.controller';
import { BankStatementsService } from './bank-statements.service';
import { Provider } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { Request } from 'express';
import { User } from 'src/users/entities/user.entity';
import { BankStatementsGetDto } from './dto/bank-statements-get.dto';
import { CoreBankStatementsInterface } from 'src/core-bank/interfaces/core-bank-statements.interface';

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
        cpfCnpj: 'cpfCnpj_1',
      } as User;
      const request = {
        user: {
          id: user.id,
        },
      } as unknown as Request;
      const args = {} as BankStatementsGetDto;
      const bankStatements = [
        { id: 0, cpfCnpj: 'cpfCnpj_1' },
        { id: 1, cpfCnpj: 'cpfCnpj_1' },
        { id: 2, cpfCnpj: 'cpfCnpj_1' },
      ] as Partial<CoreBankStatementsInterface>[] as CoreBankStatementsInterface[];
      jest
        .spyOn(bankStatementsService, 'getBankStatementsFromUser')
        .mockReturnValueOnce(bankStatements);
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
        .mockImplementationOnce(() => {
          throw new Error();
        });
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
