import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { differenceInDays, subDays } from 'date-fns';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { getDateYMDString } from 'src/utils/date-utils';
import { BSTimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { getPaymentDates, getPaymentWeek } from 'src/utils/payment-date-utils';
import { IBankStatement } from './interfaces/bank-statement.interface';
import { IBSGetMeArgs } from './interfaces/bs-get-me-args.interface';
import { IBSGetMeResponse } from './interfaces/bs-get-me-response.interface';
import { IBSGetMeDayArgs } from './interfaces/bs-get-me-day-args.interface';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { IBSGetMeDayResponse } from './interfaces/bs-get-me-day-response.interface';

/**
 * Get weekly statements
 */
@Injectable()
export class BankStatementsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly ticketRevenuesService: TicketRevenuesService,
  ) {}

  public async getMe(args: IBSGetMeArgs): Promise<IBSGetMeResponse> {
    const validArgs = await this.validateGetMe(args);
    let todaySum = 0;
    const insertedData = await this.getBankStatements(
      {
        groupBy: 'week',
        startDate: validArgs.startDate,
        endDate: validArgs.endDate,
        timeInterval: validArgs.timeInterval,
        userId: validArgs.user.id,
      },
      validArgs.user,
    );
    todaySum = insertedData.todaySum;
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

  private async validateGetMe(args: IBSGetMeArgs): Promise<{
    startDate: undefined;
    endDate?: string;
    timeInterval?: BSTimeIntervalEnum;
    user: User;
  }> {
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

    return {
      startDate: undefined,
      endDate: args?.endDate,
      timeInterval: args?.timeInterval,
      user: user,
    };
  }

  /**
   * Get grouped bank statements
   * @throws `HttpException`
   */
  private async getBankStatements(
    args: {
      groupBy: 'day' | 'week';
      startDate?: string;
      endDate?: string;
      timeInterval?: BSTimeIntervalEnum;
      userId?: number;
    },
    user: User,
  ): Promise<{
    todaySum: number;
    allSum: number;
    countSum: number;
    statements: IBankStatement[];
  }> {
    const intervalBSDates = getPaymentDates(
      'bank-statements',
      args?.startDate,
      args?.endDate,
      args?.timeInterval,
    );
    const dailyTRDates = getPaymentDates(
      'ticket-revenues',
      args?.startDate,
      args?.endDate,
      args?.timeInterval,
    );

    // Get daily data form tickets/me
    const revenuesResponse = await this.ticketRevenuesService.getMeFromUser(
      {
        startDate: getDateYMDString(dailyTRDates.startDate),
        endDate: getDateYMDString(dailyTRDates.endDate),
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
    const dayDiff = args.groupBy === 'week' ? 7 : 1;
    const maxId =
      Math.ceil(
        differenceInDays(intervalBSDates.endDate, intervalBSDates.startDate) /
          dayDiff,
      ) + 1;
    let id = 0;
    for (
      let endDate = intervalBSDates.endDate;
      endDate >= intervalBSDates.startDate;
      endDate = subDays(endDate, dayDiff)
    ) {
      const dateInterval =
        args.groupBy === 'week'
          ? getPaymentWeek(endDate)
          : { startDate: endDate, endDate };

      const revenuesWeek = revenuesResponse.data.filter(
        (i) =>
          new Date(i.partitionDate) >= dateInterval.startDate &&
          new Date(i.partitionDate) <= dateInterval.endDate,
      );
      const weekAmount = revenuesWeek.reduce(
        (sum, i) => sum + i.transactionValueSum,
        0,
      );
      newStatements.push({
        id: maxId - id,
        amount: Number(weekAmount.toFixed(2)),
        cpfCnpj: user.getCpfCnpj(),
        date: getDateYMDString(endDate),
        permitCode: user.getPermitCode(),
        status: '',
        statusCode: '',
      });
      allSum += Number(weekAmount.toFixed(2));
      id += 1;
    }
    const countSum = revenuesResponse.ticketCount;
    return { todaySum, allSum, countSum, statements: newStatements };
  }

  public async getMeDay(args: IBSGetMeDayArgs): Promise<IBSGetMeDayResponse> {
    // const validArgs =
    await this.validateGetMeDay(args);
    // const insertedData = await this.getBankStatements(
    //   {
    //     groupBy: 'day',
    //     endDate: validArgs.endDate,
    //     timeInterval: BSTimeIntervalEnum.LAST_DAY,
    //     userId: validArgs.user.id,
    //   },
    //   validArgs.user,
    // );
    // const amountSum = Number(
    //   insertedData.statements
    //     .reduce((sum, item) => sum + item.amount, 0)
    //     .toFixed(2),
    // );

    return {
      valueToReceive: 0,
    };
  }

  private async validateGetMeDay(args: IBSGetMeDayArgs): Promise<{
    endDate: string;
    user: User;
  }> {
    if (isNaN(args?.userId as number)) {
      throw CommonHttpException.argNotType('userId', 'number', args?.userId);
    }
    const user = await this.usersService.getOne({ id: args?.userId });
    return {
      endDate: args?.endDate,
      user: user,
    };
  }

  public async getMePreviousDays(
    args: IBSGetMeDayArgs,
  ): Promise<IBSGetMeDayResponse> {
    // const validArgs =
    await this.validateGetMeDay(args);
    // const insertedData = await this.getBankStatements(
    //   {
    //     groupBy: 'day',
    //     endDate: validArgs.endDate,
    //     timeInterval: BSTimeIntervalEnum.LAST_DAY,
    //     userId: validArgs.user.id,
    //   },
    //   validArgs.user,
    // );
    // const amountSum = Number(
    //   insertedData.statements
    //     .reduce((sum, item) => sum + item.amount, 0)
    //     .toFixed(2),
    // );

    return {
      valueToReceive: 0,
    };
  }
}
