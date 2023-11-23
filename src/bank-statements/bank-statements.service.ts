import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { ICoreBankStatements } from 'src/core-bank/interfaces/core-bank-statements.interface';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { UsersService } from 'src/users/users.service';
import { getDateYMDString } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { getPaymentDates, getPaymentWeek } from 'src/utils/payment-date-utils';
import { IBankStatementsGet } from './interfaces/bank-statements-get.interface';
import { IBankStatementsResponse } from './interfaces/bank-statements-response.interface';

@Injectable()
export class BankStatementsService {
  constructor(
    private readonly coreBankService: CoreBankService,
    private readonly usersService: UsersService,
    private readonly ticketRevenuesService: TicketRevenuesService,
  ) {}

  public async getBankStatementsFromUser(
    args: IBankStatementsGet,
    endpoint: string,
  ): Promise<IBankStatementsResponse> {
    if (isNaN(args?.userId as number)) {
      throw new HttpException(
        {
          details: {
            userId: `field is ${args?.userId}`,
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    // For now it validates if user exists
    const user = await this.usersService.getOne({ id: args?.userId });
    if (!user.permitCode) {
      throw new HttpException(
        {
          error: {
            message: 'User not found',
            user: {
              permitCode: 'fieldIsEmpty',
            },
          },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // TODO: fetch instead of mockup
    let bankStatementsResponse: ICoreBankStatements[] = [];
    if (this.coreBankService.isPermitCodeExists(user.permitCode)) {
      bankStatementsResponse =
        this.coreBankService.getBankStatementsByPermitCode(user.permitCode);
    } else {
      bankStatementsResponse = this.coreBankService.getBankStatementsMocked();
    }

    const { startDate, endDate } = getPaymentDates(
      endpoint,
      args?.startDate,
      args?.endDate,
      args?.timeInterval,
    );

    let treatedData = bankStatementsResponse.filter((item) => {
      const itemDate: Date = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });

    let todaySum = 0;
    const insertedData = await this.insertTicketData(treatedData, {
      endDate: args?.endDate,
      timeInterval: args?.timeInterval,
      userId: args?.userId,
    });
    treatedData = insertedData.statements;
    todaySum = insertedData.todaySum;
    // }
    const amountSum = Number(
      treatedData.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
    );
    const ticketCount = insertedData.countSum;

    return {
      amountSum,
      todaySum,
      count: treatedData.length,
      ticketCount,
      data: treatedData,
    };
  }

  //#region mockData

  private async insertTicketData(
    statements: ICoreBankStatements[],
    args: IBankStatementsGet,
  ): Promise<{
    statements: ICoreBankStatements[];
    todaySum: number;
    allSum: number;
    countSum: number;
  }> {
    const statementsDates = getPaymentDates(
      'ticket-revenues',
      undefined,
      undefined,
      TimeIntervalEnum.LAST_MONTH,
    );

    // Get daily data form tickets/me
    const revenuesResponse = await this.ticketRevenuesService.getMeFromUser(
      {
        startDate: getDateYMDString(statementsDates.startDate),
        endDate: getDateYMDString(statementsDates.endDate),
        userId: args?.userId,
        groupBy: 'day',
      },
      { limit: 9999, page: 1 },
      'ticket-revenues',
    );

    const todaySum = revenuesResponse.todaySum;
    let allSum = 0;
    const newStatements: ICoreBankStatements[] = [];

    // for each week in month (bank-statements)
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const weekInterval = getPaymentWeek(new Date(statement.date));

      // for each day in ticket revenues
      const newAmount = Number(
        revenuesResponse.data
          .filter(
            (i) =>
              new Date(i.partitionDate) >= weekInterval.startDate &&
              new Date(i.partitionDate) <= weekInterval.endDate,
          )
          .reduce((sum, i) => sum + i.transactionValueSum, 0)
          .toFixed(2),
      );

      newStatements.push({
        ...statement,
        amount: newAmount,
      });
      allSum += newAmount;
    }
    const countSum = revenuesResponse.ticketCount;
    return { todaySum, allSum, countSum, statements: newStatements };
  }

  //#endregion mockData
}
