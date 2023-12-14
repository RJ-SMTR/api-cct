import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { ICoreBankStatements } from 'src/core-bank/interfaces/core-bank-statements.interface';
import { ITicketRevenuesGroup } from 'src/ticket-revenues/interfaces/ticket-revenues-group.interface';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { getDateYMDString } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { BankStatementsService } from './bank-statements.service';

const allBankStatements = [
  { id: 0, cpfCnpj: 'cc_1', permitCode: 'pc_1', date: '2023-01-27', amount: 1 },
  { id: 1, cpfCnpj: 'cc_1', permitCode: 'pc_1', date: '2023-01-20', amount: 2 },
  { id: 2, cpfCnpj: 'cc_1', permitCode: 'pc_1', date: '2023-01-13', amount: 3 },
  { id: 3, cpfCnpj: 'cc_1', permitCode: 'pc_1', date: '2023-01-06', amount: 4 },
] as Partial<ICoreBankStatements>[] as ICoreBankStatements[];

describe('BankStatementsService', () => {
  const endpoint = 'bank-statements';

  let bankStatementsService: BankStatementsService;
  let coreBankService: CoreBankService;
  let usersService: UsersService;
  let ticketRevenuesService: TicketRevenuesService;

  beforeEach(async () => {
    const coreBankServiceMock = {
      provide: CoreBankService,
      useValue: {
        getBankStatementsMocked: jest.fn(),
        getBankStatementsByPermitCode: jest.fn(),
        isPermitCodeExists: jest.fn(),
        update: jest.fn().mockReturnValue(undefined),
      },
    } as Provider;
    const usersServiceMock = {
      provide: UsersService,
      useValue: {
        create: jest.fn(),
        getOne: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
      },
    } as Provider;
    const ticketRevenuesServiceMock = {
      provide: TicketRevenuesService,
      useValue: {
        getGroupedFromUser: jest.fn(),
        getMeFromUser: jest.fn(),
      },
    } as Provider;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankStatementsService,
        coreBankServiceMock,
        usersServiceMock,
        ticketRevenuesServiceMock,
      ],
    }).compile();

    bankStatementsService = module.get<BankStatementsService>(
      BankStatementsService,
    );
    coreBankService = module.get<CoreBankService>(CoreBankService);
    usersService = module.get<UsersService>(UsersService);
    ticketRevenuesService = module.get<TicketRevenuesService>(
      TicketRevenuesService,
    );
  });

  it('should be defined', () => {
    expect(bankStatementsService).toBeDefined();
    expect(coreBankService).toBeDefined();
  });

  describe('getBankStatementsFromUser', () => {
    it('should return statements for previous days when user fetched successfully', async () => {
      // Arrange
      // const bankStatements = allBankStatements.filter(
      //   (i) => i.permitCode === 'pc_1',
      // );

      const revenuesGroup: ITicketRevenuesGroup[] = [];
      for (let day = 0; day < 14; day++) {
        const date = new Date('2023-01-11');
        date.setDate(date.getDate() - day);
        revenuesGroup.push({
          count: 1,
          partitionDate: getDateYMDString(date),
          transportTypeCounts: {
            [day.toString()]: { count: 1, transactionValue: 10 },
          },
          paymentMediaTypeCounts: {
            [`media_${day}`]: { count: 1, transactionValue: 10 },
          },
          transportIntegrationTypeCounts: {
            [`integration_${day}`]: { count: 1, transactionValue: 10 },
          },
          transactionTypeCounts: {
            [`Integração`]: { count: 1, transactionValue: 10 },
          },
          transactionValueSum: 10,
          permitCode: `permitCode_1`,
          directionIdCounts: { 0: { count: 1, transactionValue: 10 } },
          stopIdCounts: {
            [day.toString()]: { count: 1, transactionValue: 10 },
          },
          stopLatCounts: {
            [day.toString()]: { count: 1, transactionValue: 10 },
          },
          stopLonCounts: {
            [day.toString()]: { count: 1, transactionValue: 10 },
          },
          aux_epochWeek: 10,
          aux_groupDateTime: '2023-01',
        });
      }

      jest.spyOn(usersService, 'getOne').mockResolvedValue(
        new User({
          id: 1,
          permitCode: '123456',
          email: 'user1@example.com',
          hash: 'hash_1',
        }),
      );
      jest.spyOn(coreBankService, 'isPermitCodeExists').mockReturnValue(true);
      jest
        .spyOn(coreBankService, 'getBankStatementsByPermitCode')
        .mockReturnValue(allBankStatements);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-22').valueOf());
      jest.spyOn(ticketRevenuesService, 'getMeFromUser').mockResolvedValue({
        startDate: '2023-01-06',
        endDate: '2023-01-13',
        amountSum: 70,
        todaySum: 170,
        ticketCount: 8,
        count: 2,
        data: revenuesGroup.slice(9, 17),
      });

      // Act
      const result = await bankStatementsService.getBankStatementsFromUser(
        {
          timeInterval: TimeIntervalEnum.LAST_2_WEEKS,
          userId: 1,
        },
        endpoint,
      );

      // Assert
      expect(result).toEqual({
        amountSum: 70,
        todaySum: 170,
        count: 8,
        ticketCount: 8,
        data: allBankStatements.slice(0, 3),
      });
    });

    it('should return statements between dates when user fetched successfully', async () => {
      // Arrange
      const bankStatements = allBankStatements.filter(
        (i) => i.permitCode === 'pc_1',
      );

      const revenuesGroup: ITicketRevenuesGroup[] = [];
      for (let day = 0; day < 14; day++) {
        const date = new Date('2023-01-11');
        date.setDate(date.getDate() - day);
        revenuesGroup.push({
          count: 1,
          partitionDate: getDateYMDString(date),
          transportTypeCounts: {
            [day.toString()]: { count: 1, transactionValue: 10 },
          },
          paymentMediaTypeCounts: {
            [`media_${day}`]: { count: 1, transactionValue: 10 },
          },
          transportIntegrationTypeCounts: {
            [`integration_${day}`]: { count: 1, transactionValue: 10 },
          },
          transactionTypeCounts: {
            [`Integração`]: { count: 1, transactionValue: 10 },
          },
          transactionValueSum: 10,
          permitCode: `permitCode_1`,
          directionIdCounts: { 0: { count: 1, transactionValue: 10 } },
          stopIdCounts: {
            [day.toString()]: { count: 1, transactionValue: 10 },
          },
          stopLatCounts: {
            [day.toString()]: { count: 1, transactionValue: 10 },
          },
          stopLonCounts: {
            [day.toString()]: { count: 1, transactionValue: 10 },
          },
          aux_epochWeek: 10,
          aux_groupDateTime: '2023-01',
        });
      }

      const user = {
        id: 1,
        permitCode: '123456',
        cpfCnpj: bankStatements[0].cpfCnpj,
      } as User;

      jest.spyOn(usersService, 'getOne').mockResolvedValue(user);
      jest.spyOn(coreBankService, 'isPermitCodeExists').mockReturnValue(true);
      jest
        .spyOn(coreBankService, 'getBankStatementsByPermitCode')
        .mockReturnValueOnce(bankStatements);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-22').valueOf());
      jest.spyOn(ticketRevenuesService, 'getMeFromUser').mockResolvedValue({
        startDate: '2022-12-29',
        endDate: '2023-01-11',
        amountSum: 140,
        todaySum: 10,
        ticketCount: 14,
        count: 14,
        data: revenuesGroup,
      });

      // Act
      const result = await bankStatementsService.getBankStatementsFromUser(
        {
          userId: 1,
          startDate: '2022-01-06',
          endDate: '2023-01-13',
        },
        endpoint,
      );

      // Assert
      expect(result).toEqual({
        amountSum: 140,
        todaySum: 10,
        count: 2,
        ticketCount: 14,
        data: [
          {
            id: 2,
            cpfCnpj: 'cc_1',
            permitCode: 'pc_1',
            date: '2023-01-13',
            amount: 70,
          },
          {
            id: 3,
            cpfCnpj: 'cc_1',
            permitCode: 'pc_1',
            date: '2023-01-06',
            amount: 70,
          },
        ],
      });
    });

    it('should throw exception when profile is not found', async () => {
      // Arrange
      jest.spyOn(usersService, 'getOne').mockRejectedValue(new Error());
      jest.spyOn(coreBankService, 'isPermitCodeExists').mockReturnValue(false);
      jest
        .spyOn(coreBankService, 'getBankStatementsMocked')
        .mockReturnValue(allBankStatements);

      // Assert
      await expect(
        bankStatementsService.getBankStatementsFromUser(
          {
            userId: 0,
            timeInterval: TimeIntervalEnum.LAST_WEEK,
          },
          endpoint,
        ),
      ).rejects.toThrowError();
    });
  });
});
