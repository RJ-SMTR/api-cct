import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { differenceInDays, subDays } from 'date-fns';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { getDateYMDString } from 'src/utils/date-utils';
import { getPaymentDates, getPaymentWeek } from 'src/utils/payment-date-utils';
import { IBankStatement } from './interfaces/bank-statement.interface';
import { IBankStatementsGet } from './interfaces/bank-statements-get.interface';
import { IBankStatementsResponse } from './interfaces/bank-statements-response.interface';

/**
 * Get weekly statements
 */
@Injectable()
export class BankStatementsService {
  constructor(
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

    if (args?.startDate) {
      throw new HttpException(
        {
          error: {
            code: 'invalid_request-startDate-forbidden',
            message:
              'Invalid request: start_date not allowed, filter only by endDate + timeInterval.',
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // For now it validates if user exists
    const user = await this.usersService.getOne({ id: args?.userId });
    if (!user.permitCode || !user.id) {
      throw new HttpException(
        {
          error: {
            message: 'User not found',
            user: {
              ...(!user.permitCode ? { permitCode: 'fieldIsEmpty' } : {}),
              ...(!user.id ? { id: 'fieldIsEmpty' } : {}),
            },
          },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    let todaySum = 0;
    const insertedData = await this.getBankStatements(
      {
        startDate: args?.startDate,
        endDate: args?.endDate,
        timeInterval: args?.timeInterval,
        userId: args?.userId,
      },
      user,
    );
    todaySum = insertedData.todaySum;
    // }
    const amountSum = Number(
      insertedData.statements
        .reduce((sum, item) => sum + item.amount, 0)
        .toFixed(2),
    );
    const ticketCount = insertedData.countSum;

    return {
      amountSum,
      todaySum,
      count: insertedData.statements.length,
      ticketCount,
      data: insertedData.statements,
    };
  }

  private async getBankStatements(
    args: IBankStatementsGet,
    user: User,
  ): Promise<{
    todaySum: number;
    allSum: number;
    countSum: number;
    statements: IBankStatement[];
  }> {
    const weekBStatementDates = getPaymentDates(
      'bank-statements',
      args?.startDate,
      args?.endDate,
      args?.timeInterval,
    );
    const dailyTRevenueDates = getPaymentDates(
      'ticket-revenues',
      args?.startDate,
      args?.endDate,
      args?.timeInterval,
    );

    // Get daily data form tickets/me
    const revenuesResponse = await this.ticketRevenuesService.getMeFromUser(
      {
        startDate: getDateYMDString(dailyTRevenueDates.startDate),
        endDate: getDateYMDString(dailyTRevenueDates.endDate),
        userId: args?.userId,
        groupBy: 'day',
      },
      { limit: 9999, page: 1 },
      'ticket-revenues',
    );

    const todaySum = revenuesResponse.todaySum;
    let allSum = 0;
    const newStatements: IBankStatement[] = [];

    // for each week in interval (bankStatements)
    const maxId =
      Math.ceil(
        differenceInDays(
          weekBStatementDates.endDate,
          weekBStatementDates.startDate,
        ) / 7,
      ) + 1;
    let id = 0;
    for (
      let week = weekBStatementDates.endDate;
      week >= weekBStatementDates.startDate;
      week = subDays(week, 7)
    ) {
      const weekInterval = getPaymentWeek(week);
      const revenuesWeek = revenuesResponse.data.filter(
        (i) =>
          new Date(i.partitionDate) >= weekInterval.startDate &&
          new Date(i.partitionDate) <= weekInterval.endDate,
      );
      const weekAmount = revenuesWeek.reduce(
        (sum, i) => sum + i.transactionValueSum,
        0,
      );
      newStatements.push({
        id: maxId - id,
        amount: Number(weekAmount.toFixed(2)),
        cpfCnpj: user.cpfCnpj as string,
        date: getDateYMDString(week),
        permitCode: user.permitCode as string,
        status: '',
        statusCode: '',
      });
      allSum += Number(weekAmount.toFixed(2));
      id += 1;
    }
    const countSum = revenuesResponse.ticketCount;
    return { todaySum, allSum, countSum, statements: newStatements };
  }
}
