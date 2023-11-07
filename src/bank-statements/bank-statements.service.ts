import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { ICoreBankStatements } from 'src/core-bank/interfaces/core-bank-statements.interface';
import { ITicketRevenuesGetGrouped } from 'src/ticket-revenues/interfaces/ticket-revenues-get-grouped.interface';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { UsersService } from 'src/users/users.service';
import { getDateYMDString, getStartEndDates } from 'src/utils/date-utils';
import {
  getDatesFromTimeInterval,
  getPaymentDates,
  goPreviousDays,
  nextPaymentWeekday,
} from 'src/utils/payment-date-utils';
import { DateIntervalType } from 'src/utils/types/date-interval.type';
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

    // TODO: fetch instead of mockup
    let bankStatementsResponse: ICoreBankStatements[] = [];
    if (this.coreBankService.isPermitCodeExists(user.permitCode)) {
      bankStatementsResponse =
        this.coreBankService.getBankStatementsByPermitCode(user.permitCode);
    } else {
      bankStatementsResponse = this.coreBankService.getBankStatementsMocked();
    }

    let startDate = new Date();
    let endDate = new Date();
    // if (args?.startDate && args.endDate) {
    //   const dates = this.getDates(args);
    //   startDate = dates.startDate;
    //   endDate = dates.endDate;
    // }
    // else {
    const endDateStr =
      args?.endDate ||
      getDateYMDString(nextPaymentWeekday(new Date(Date.now())));
    const dates = getStartEndDates({
      startDateStr: args?.startDate,
      endDateStr: endDateStr,
      timeInterval: args?.timeInterval,
    });
    startDate = dates.startDate;
    endDate = dates.endDate;
    // }

    let treatedData = bankStatementsResponse.filter((item) => {
      const itemDate: Date = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });

    let sumToday = 0;
    // if (this.coreBankService.isPermitCodeExists(user.permitCode)) {
    const insertedData = await this.insertTicketData(treatedData, {
      endDate: endDateStr,
      timeInterval: args?.timeInterval,
      userId: args?.userId,
    });
    treatedData = insertedData.statements;
    sumToday = insertedData.sumToday;
    // }
    const amountSum = treatedData.reduce((sum, item) => sum + item.amount, 0);

    return {
      data: treatedData,
      amountSum,
      todaySum: sumToday,
    };
  }

  //#region mockData

  private async insertTicketData(
    statements: ICoreBankStatements[],
    args: IBankStatementsGet,
  ): Promise<{
    statements: ICoreBankStatements[];
    sumToday: number;
    allSum: number;
  }> {
    const revenuesArgs: ITicketRevenuesGetGrouped = {
      endDate: args?.endDate as string,
      timeInterval: args?.timeInterval,
      userId: args?.userId,
      groupBy: 'day',
    };
    const revenuesResponse = await this.ticketRevenuesService.getMeFromUser(
      revenuesArgs,
      { limit: 9999, page: 1 },
    );
    const sumToday = revenuesResponse.transactionValueLastDay;
    let sumAll = 0;
    const newStatements: ICoreBankStatements[] = [];
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const statementDate = new Date(statement.date);
      const statementInterval = goPreviousDays({
        endDateStr: getDateYMDString(statementDate),
      });
      let newAmount = 0;
      for (const revenue of revenuesResponse.data) {
        const itemDate = new Date(revenue.partitionDate);
        const isFromStart = itemDate >= statementInterval.startDate;
        const isToEnd = itemDate <= statementInterval.endDate;
        if (isFromStart && isToEnd) {
          newAmount += revenue.transactionValueSum;
        }
      }
      newStatements.push({
        ...statement,
        amount: newAmount,
      });
      sumAll += newAmount;
    }
    return { sumToday, allSum: sumAll, statements: newStatements };
  }

  //#endregion mockData

  //#region dates

  private getDates(args: Partial<IBankStatementsGet>): DateIntervalType {
    const endDateStr = getDateYMDString(new Date());
    const timeInterval = args?.timeInterval;
    // if (!args?.endDate) {
    //   timeInterval = undefined;
    // }
    let { startDate, endDate } = getPaymentDates({
      startDateStr: args.startDate,
      endDateStr: endDateStr,
      timeInterval,
    });
    const dates = getDatesFromTimeInterval({
      startDate,
      endDate,
      timeInterval: args.timeInterval,
    });
    startDate = dates.startDate;
    endDate = dates.endDate;
    return { startDate, endDate };
  }

  //#endregion dates
}
