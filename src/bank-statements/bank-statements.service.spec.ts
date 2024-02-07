import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ITicketRevenuesGroup } from 'src/ticket-revenues/interfaces/ticket-revenues-group.interface';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { getDateYMDString } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { BankStatementsService } from './bank-statements.service';
import { IBankStatement } from './interfaces/bank-statement.interface';

const allBankStatements = [
  { id: 1, date: '2023-01-27', amount: 1 },
  { id: 2, date: '2023-01-20', amount: 2 },
  { id: 3, date: '2023-01-13', amount: 3 },
  { id: 4, date: '2023-01-06', amount: 4 },
].map((i) => ({
  ...i,
  cpfCnpj: 'cc_1',
  permitCode: 'pc_1',
})) as Partial<IBankStatement>[] as IBankStatement[];

describe('BankStatementsService', () => {
  let bankStatementsService: BankStatementsService;
  let usersService: UsersService;
  let ticketRevenuesService: TicketRevenuesService;

  beforeEach(async () => {
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
        getMe: jest.fn(),
      },
    } as Provider;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankStatementsService,
        usersServiceMock,
        ticketRevenuesServiceMock,
      ],
    }).compile();

    bankStatementsService = module.get<BankStatementsService>(
      BankStatementsService,
    );
    usersService = module.get<UsersService>(UsersService);
    ticketRevenuesService = module.get<TicketRevenuesService>(
      TicketRevenuesService,
    );
  });

  it('should be defined', () => {
    expect(bankStatementsService).toBeDefined();
  });

  describe('getBankStatementsFromUser', () => {
    it('should filter last 2 weeks', /**
     * Requirement: 2024/01/18 {@link https://github.com/RJ-SMTR/api-cct/issues/168#issuecomment-1898457310 #168, item 1 - GitHub}
     *
     * Mocked today: 2023/01/22
     *
     * bank-statements time interval (last 2 weeks):
     * ```
     * Input dates         a    Output dates         b
     * ╔════════════════════╗   ╔════════════════════╗
     * ║ January       2023 ║   ║ January       2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢   ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║   ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║01│02│03│04│05│06│07║   ║01│02│03│04│05│06│07║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║08│09│10│11│12│13│14║   ║08│09│10│11│12│04│14║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──╔══╗──╢
     * ║15│16│17│18│19│20│21║   ║15│16│17│18│19║20║21║
     * ╔══╗──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──╔══╗──╢
     * ║22║23│24│25│26│27│28║   ║22│23│24│25│26║27║28║
     * ╚══╝──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──╚══╝──╢
     * ║29│30│31│  │  │  │  ║   ║29│30│31│  │  │  │  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝   ╚══╧══╧══╧══╧══╧══╧══╝
     * ```
     *
     * ticket-revenues time interval:
     * ```
     * Input dates          c   Output dates         d
     * ╔════════════════════╗   ╔════════════════════╗
     * ║ January       2023 ║   ║ January       2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢   ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║   ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║01│02│03│04│05│06│07║   ║01│02│03│04│05│06│07║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──╔══╗──┼──╢
     * ║08│09│10│11│12│13│14║   ║08│09│10│11║12║13│14║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──╚══╝──┼──╢
     * ║15│16│17│18│19│20│21║   ║15│16│17│18│19│20│21║
     * ╔══╗──┼──┼──┼──┼──┼──╢   ╔──╗──┼──╔══╗──┼──┼──╢
     * ║22║23│24│25│26|27|28║   │22│23│24║25║26|27|28║
     * ╚══╝──┼──┼──┼──┼──┼──╢   ╚──╝──┼──╚══╝──┼──┼──╢
     * ║29│30│31│  │  │  │  ║   ║29│30│31│  │  │  │  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝   ╚══╧══╧══╧══╧══╧══╧══╝
     * ```
     */ async () => {
      // Arrange
      const bankStatements = allBankStatements.filter(
        (i) => i.permitCode === 'pc_1',
      );

      const revenuesGroup: ITicketRevenuesGroup[] = [];
      // from 2023-01-22 to 2023-01-12 (calendar d.)
      for (let day = 0; day < 11; day++) {
        const date = new Date('2023-01-22');
        date.setDate(date.getDate() - day);
        revenuesGroup.push({
          count: 1,
          partitionDate: getDateYMDString(date),
          transportTypeCounts: {
            [`tt_${day.toString()}`]: { count: 1, transactionValue: 10 },
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
          permitCode: 'pc_1',
          email: 'user1@example.com',
          cpfCnpj: bankStatements[0].cpfCnpj,
          hash: 'hash_1',
        }),
      );
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-22').valueOf());
      jest.spyOn(ticketRevenuesService, 'getMe').mockResolvedValue({
        startDate: '2023-01-12',
        endDate: '2023-01-22',
        amountSum: 110,
        todaySum: 10,
        ticketCount: 11,
        count: 11,
        data: revenuesGroup,
      });

      // Act
      const result = await bankStatementsService.getMe({
        timeInterval: TimeIntervalEnum.LAST_2_WEEKS,
        userId: 1,
      });

      // Assert
      expect(result).toEqual({
        amountSum: 110,
        todaySum: 10,
        count: 2,
        ticketCount: 11,
        data: [
          {
            id: 2,
            date: '2023-01-27',
            effectivePaymentDate: null,
            amount: 40,
            status: 'A pagar',
            statusCode: 'toPay',
            bankStatus: null,
            bankStatusCode: null,
          },
          {
            id: 1,
            date: '2023-01-20',
            effectivePaymentDate: '2023-01-20',
            amount: 70,
            status: 'Pago',
            statusCode: 'paid',
            bankStatus: '00',
            bankStatusCode: 'Crédito ou Débito Efetivado',
          },
        ].map((i) => ({
          ...i,
          cpfCnpj: 'cc_1',
          transactionDate: i.date,
          processingDate: i.date,
          paymentOrderDate: i.date,
          permitCode: 'pc_1',
          error: null,
          errorCode: null,
        })),
      });
    });

    it('should filter last week', /**
     * Requirement: 2024/01/18 {@link https://github.com/RJ-SMTR/api-cct/issues/168#issuecomment-1898457310 #168, item 2 - GitHub}
     *
     * Mocked today: 2023/01/25
     *
     * bank-statements time interval (last week):
     * ```
     * Input dates         a    Output dates         b
     * ╔════════════════════╗   ╔════════════════════╗
     * ║ January       2023 ║   ║ January       2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢   ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║   ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║01│02│03│04│05│06│07║   ║01│02│03│04│05│06│07║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║08│09│10│11│12│13│14║   ║08│09│10│11│12│13│14║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║15│16│17│18│19│20│21║   ║15│16│17│18│19│20│21║
     * ╟──┼──┼──╔══╗──┼──┼──╢   ╟──┼──┼──┼──┼──╔══╗──╢
     * ║22│23│24║25║26│27│28║   ║22│23│24│25│26║27║28║
     * ╟──┼──┼──╚══╝──┼──┼──╢   ╟──┼──┼──┼──┼──╚══╝──╢
     * ║29│30│31│  │  │  │  ║   ║29│30│31│  │  │  │  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝   ╚══╧══╧══╧══╧══╧══╧══╝
     * ```
     *
     * ticket-revenues time interval:
     * ```
     * Input dates          c   Output dates         d
     * ╔════════════════════╗   ╔════════════════════╗
     * ║ January       2023 ║   ║ January       2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢   ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║   ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║01│02│03│04│05│06│07║   ║01│02│03│04│05│06│07║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║08│09│10│11│12│13│14║   ║08│09│10│11│12│04│14║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──╔══╗──┼──╢
     * ║15│16│17│18│19│20│21║   ║15│16│17│18║19║20│21║
     * ╟──┼──┼──╔══╗──┼──┼──╢   ╟──┼──┼──╔══╗══╝──┼──╢
     * ║22│23│24║25║26│27│28║   ║22│23│24║25║26│27│28║
     * ╟──┼──┼──╚══╝──┼──┼──╢   ╟──┼──┼──╚══╝──┼──┼──╢
     * ║29│30│31│  │  │  │  ║   ║29│30│31│  │  │  │  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝   ╚══╧══╧══╧══╧══╧══╧══╝
     * ```
     */ async () => {
      // Arrange
      const bankStatements = allBankStatements.filter(
        (i) => i.cpfCnpj === 'cc_1',
      );

      const revenuesGroup: ITicketRevenuesGroup[] = [];
      // from 2023-01-22 to 2023-01-12 (calendar d.)
      for (let day = 0; day < 7; day++) {
        const date = new Date('2023-01-25');
        date.setDate(date.getDate() - day);
        revenuesGroup.push({
          count: 1,
          partitionDate: getDateYMDString(date),
          transportTypeCounts: {
            [`tt_${day.toString()}`]: { count: 1, transactionValue: 10 },
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
          permitCode: 'pc_1',
          email: 'user1@example.com',
          cpfCnpj: bankStatements[0].cpfCnpj,
          hash: 'hash_1',
        }),
      );
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-25').valueOf());
      jest.spyOn(ticketRevenuesService, 'getMe').mockResolvedValue({
        startDate: null,
        endDate: '2023-01-25',
        amountSum: 70,
        todaySum: 10,
        ticketCount: 7,
        count: 7,
        data: revenuesGroup,
      });

      // Act
      const result = await bankStatementsService.getMe({
        timeInterval: TimeIntervalEnum.LAST_WEEK,
        userId: 1,
      });

      // Assert
      expect(result).toEqual({
        amountSum: 70,
        todaySum: 10,
        count: 1,
        ticketCount: 7,
        data: [
          {
            id: 1,
            cpfCnpj: 'cc_1',
            permitCode: 'pc_1',
            date: '2023-01-27',
            paymentOrderDate: '2023-01-27',
            processingDate: '2023-01-27',
            transactionDate: '2023-01-27',
            amount: 70,
            status: 'A pagar',
            statusCode: 'toPay',
            error: null,
            errorCode: null,
            bankStatus: null,
            bankStatusCode: null,
            effectivePaymentDate: null,
          },
        ],
      });
    });

    it('should filter last month', /**
     * Requirement: 2024/01/18 {@link https://github.com/RJ-SMTR/api-cct/issues/168#issuecomment-1898457310 #168, item 3 - GitHub}
     *
     * Mocked today: 2023/01/17
     *
     * bank-statements time interval (last month):
     * ```
     * Input dates         a    Expected output      b
     * ╔════════════════════╗   ╔════════════════════╗
     * ║ January       2023 ║   ║ January       2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢   ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║   ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──╔══╗──╢
     * ║01│02│03│04│05│06│07║   ║01│02│03│04│05║06║07║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──╚══╝──╢
     * ║08│09│10│11│12│13│14║   ║08│09│10│11│12│13│14║
     * ╟──┼──╔══╗──┼──┼──┼──╢   ╟──┼──┼──┼──┼──╔══╗──╢
     * ║15│16║17║18│19│20│21║   ║15│16│17│18│19║20║21║
     * ╟──┼──╚══╝──┼──┼──┼──╢   ╟──┼──┼──┼──┼──╚══╝──╢
     * ║22│23│24│25│26│27│28║   ║22│23│24│25│26│27│28║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║29│30│31│  │  │  │  ║   ║29│30│31│  │  │  │  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝   ╚══╧══╧══╧══╧══╧══╧══╝
     * ```
     *
     * ticket-revenues time interval:
     * ```
     * Input dates          c   Expected output      d
     * ╔════════════════════╗   ╔════════════════════╗
     * ║ December      2022 ║   ║ December      2022 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢   ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║   ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──╔══╗──┼──╢
     * ║25│26│27│28│29│30│31║   ║25│26│27│28║29║30│31║
     * ╠══╧══╧══╧══╧══╧══╧══╣   ╠══╧══╧══╧══╚══╝══╧══╣
     * ║ January       2023 ║   ║ January       2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢   ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║   ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║01│02│03│04│05│06│07║   ║01│02│03│04│05│06│07║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║08│09│10│11│12│13│14║   ║08│09│10│11│12│04│14║
     * ╟──┼──╔══╗──┼──┼──┼──╢   ╟──┼──╔──╔══╗──┼──┼──╢
     * ║15│16║17║18│19│20│21║   ║15│16│17║18║19│20│21║
     * ╟──┼──╚══╝──┼──┼──┼──╢   ╟──┼──╚──╚══╝──┼──┼──╢
     * ║22│23│24│25│26│27│28║   ║22│23│24│25│26│27│28║
     * ╟──┼──┼──┼──┼──┼──┼──╢   ╟──┼──┼──┼──┼──┼──┼──╢
     * ║29│30│31│  │  │  │  ║   ║29│30│31│  │  │  │  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝   ╚══╧══╧══╧══╧══╧══╧══╝
     * ```
     */ async () => {
      // Arrange
      const bankStatements = allBankStatements.filter(
        (i) => i.cpfCnpj === 'cc_1',
      );

      const revenuesGroup: ITicketRevenuesGroup[] = [];
      // from 2023-01-17 to 2022-12-29 (28 days)
      for (let day = 0; day < 20; day++) {
        const date = new Date('2023-01-17');
        date.setDate(date.getDate() - day);
        revenuesGroup.push({
          count: 1,
          partitionDate: getDateYMDString(date),
          transportTypeCounts: {
            [`tt_${day.toString()}`]: { count: 1, transactionValue: 10 },
          },
          paymentMediaTypeCounts: {
            [`media_${day}`]: { count: 1, transactionValue: 10 },
          },
          transportIntegrationTypeCounts: {
            [`integration_${day}`]: { count: 1, transactionValue: 10 },
          },
          transactionTypeCounts: {
            ['Integração']: { count: 1, transactionValue: 10 },
          },
          transactionValueSum: 10,
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
          permitCode: 'pc_1',
          email: 'user1@example.com',
          cpfCnpj: bankStatements[0].cpfCnpj,
          hash: 'hash_1',
        }),
      );
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-17').valueOf());
      jest.spyOn(ticketRevenuesService, 'getMe').mockResolvedValue({
        startDate: null,
        endDate: '2023-01-25',
        amountSum: 200,
        todaySum: 10,
        ticketCount: 20,
        count: 20,
        data: revenuesGroup,
      });

      // Act
      const result = await bankStatementsService.getMe({
        timeInterval: TimeIntervalEnum.LAST_MONTH,
        userId: 1,
      });

      // Assert
      expect(result).toEqual({
        amountSum: 200,
        todaySum: 10,
        count: 3,
        ticketCount: 20,
        data: [
          {
            id: 3,
            date: '2023-01-20',
            amount: 60,
            effectivePaymentDate: null,
            status: 'A pagar',
            statusCode: 'toPay',
            bankStatus: null,
            bankStatusCode: null,
          },
          {
            id: 2,
            date: '2023-01-13',
            amount: 70,
            effectivePaymentDate: '2023-01-13',
            status: 'Pago',
            statusCode: 'paid',
            bankStatus: '00',
            bankStatusCode: 'Crédito ou Débito Efetivado',
          },
          {
            id: 1,
            date: '2023-01-06',
            amount: 70,
            effectivePaymentDate: '2023-01-06',
            status: 'Pago',
            statusCode: 'paid',
            bankStatus: '00',
            bankStatusCode: 'Crédito ou Débito Efetivado',
          },
        ].map((i) => ({
          ...i,
          cpfCnpj: 'cc_1',
          permitCode: 'pc_1',
          paymentOrderDate: i.date,
          processingDate: i.date,
          transactionDate: i.date,
          error: null,
          errorCode: null,
        })),
      });
    });

    it('should throw exception when filtering by start-end dates', /**
     * Requirement: 2024/01/18 {@link https://github.com/RJ-SMTR/api-cct/issues/168#issuecomment-1898457310 #168, item 4 - GitHub}
     */ async () => {
      // Arrange
      const bankStatements = allBankStatements.filter(
        (i) => i.permitCode === 'pc_1',
      );

      const user = {
        id: 1,
        permitCode: 'pc_1',
        cpfCnpj: bankStatements[0].cpfCnpj,
      } as User;

      jest.spyOn(usersService, 'getOne').mockResolvedValue(user);

      // Act
      const result = bankStatementsService.getMe({
        userId: 1,
        startDate: '2023-01-05',
        endDate: '2023-01-13',
      });

      // Assert
      await expect(result).rejects.toThrowError();
    });

    it('should throw exception when profile is not found', /**
     * Requirement: 2024/01/18 {@link https://github.com/RJ-SMTR/api-cct/issues/168#issuecomment-1898457310 #168, item 5 - GitHub}
     */ async () => {
      // Arrange
      jest.spyOn(usersService, 'getOne').mockRejectedValue(new Error());

      // Assert
      await expect(
        bankStatementsService.getMe({
          userId: 0,
          timeInterval: TimeIntervalEnum.LAST_WEEK,
        }),
      ).rejects.toThrowError();
    });
  });
});
