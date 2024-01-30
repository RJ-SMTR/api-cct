import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { differenceInDays, subDays } from 'date-fns';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { getDateYMDString } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { getPaymentDates, getPaymentWeek } from 'src/utils/payment-date-utils';
import { IBankStatement } from './interfaces/bank-statement.interface';
import { IBSCounts } from './interfaces/bs-counts.interface';
import { IBSGetMeArgs } from './interfaces/bs-get-me-args.interface';
import { IBSGetMeDayArgs } from './interfaces/bs-get-me-day-args.interface';
import { IBSGetMeDayResponse } from './interfaces/bs-get-me-day-response.interface';
import { IBSGetMePreviousDaysArgs } from './interfaces/bs-get-me-previous-days-args.interface';
import { IBSGetMePreviousDaysResponse } from './interfaces/bs-get-me-previous-days-response.interface';
import { IBSGetMeResponse } from './interfaces/bs-get-me-response.interface';
import { IGetBSResponse } from './interfaces/get-bs-response.interface';

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
    const insertedData = await this.generateBankStatements({
      groupBy: 'week',
      startDate: validArgs.startDate,
      endDate: validArgs.endDate,
      timeInterval: validArgs.timeInterval,
      user: validArgs.user,
    });
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
    timeInterval?: TimeIntervalEnum;
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
  private async generateBankStatements(args: {
    groupBy: 'day' | 'week';
    startDate?: string;
    endDate?: string;
    timeInterval?: TimeIntervalEnum;
    user: User;
  }): Promise<IGetBSResponse> {
    const intervalBSDates = getPaymentDates({
      endpoint: 'bank-statements',
      startDateStr: args?.startDate,
      endDateStr: args?.endDate,
      timeInterval: args?.timeInterval,
    });
    const dailyTRDates = getPaymentDates({
      endpoint: 'ticket-revenues',
      startDateStr: args?.startDate,
      endDateStr: args?.endDate,
      timeInterval: args?.timeInterval,
    });

    // Get daily data form tickets/me
    const revenuesResponse = await this.ticketRevenuesService.getMe(
      {
        startDate: getDateYMDString(dailyTRDates.startDate),
        endDate: getDateYMDString(dailyTRDates.endDate),
        userId: args?.user.id,
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
        cpfCnpj: args.user.getCpfCnpj(),
        date: getDateYMDString(endDate),
        paymentOrderDate: getDateYMDString(endDate),
        effectivePaymentDate: null,
        permitCode: args.user.getPermitCode(),
        status: '',
        statusCode: '',
        bankStatus: null,
        bankStatusCode: null,
        error: null,
        errorCode: null,
      });
      allSum += Number(weekAmount.toFixed(2));
      id += 1;
    }
    const countSum = revenuesResponse.ticketCount;
    return { todaySum, allSum, countSum, statements: newStatements };
  }

  public async getMeDay(args: IBSGetMeDayArgs): Promise<IBSGetMeDayResponse> {
    await this.validateGetMeDay(args);
    // This data is mocked for development
    return {
      valueToReceive: 4.9,
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
    args: IBSGetMePreviousDaysArgs,
  ): Promise<IBSGetMePreviousDaysResponse> {
    const validArgs = await this.validateGetMePreviousDays(args);
    const data = this.buildPreviousDays({
      user: validArgs.user,
      endDate: validArgs.endDate,
      timeInterval: validArgs.timeInterval,
    });
    const statusCounts = this.generateStatusCounts(data);

    return {
      data: data,
      statusCounts: statusCounts,
    };
  }

  private async validateGetMePreviousDays(
    args: IBSGetMePreviousDaysArgs,
  ): Promise<{
    user: User;
    endDate?: string;
    timeInterval?: TimeIntervalEnum;
  }> {
    if (isNaN(args?.userId as number)) {
      throw CommonHttpException.argNotType('userId', 'number', args?.userId);
    }
    const user = await this.usersService.getOne({ id: args?.userId });
    return {
      user: user,
      endDate: args.endDate,
      timeInterval: args.timeInterval as unknown as TimeIntervalEnum,
    };
  }

  private buildPreviousDays(validArgs: {
    user: User;
    endDate?: string;
    timeInterval?: TimeIntervalEnum;
  }): IBankStatement[] {
    const intervalBSDates = getPaymentDates({
      endpoint: 'bank-statements',
      startDateStr: undefined,
      endDateStr: validArgs?.endDate,
      timeInterval: validArgs?.timeInterval,
    });
    // This data is mocked for development
    return [
      {
        id: 1,
        date: getDateYMDString(new Date(intervalBSDates.endDate)),
        paymentOrderDate: getDateYMDString(new Date(intervalBSDates.endDate)),
        effectivePaymentDate: null,
        cpfCnpj: validArgs.user.getCpfCnpj(),
        permitCode: validArgs.user.getPermitCode(),
        amount: 4.9,
        status: 'A pagar',
        statusCode: 'toPay',
        bankStatus: null,
        bankStatusCode: null,
        error: null,
        errorCode: null,
      },
      {
        id: 2,
        date: getDateYMDString(new Date(intervalBSDates.endDate)),
        paymentOrderDate: getDateYMDString(new Date(intervalBSDates.endDate)),
        effectivePaymentDate: null,
        cpfCnpj: validArgs.user.getCpfCnpj(),
        permitCode: validArgs.user.getPermitCode(),
        amount: 4.9,
        status: 'Pendente',
        statusCode: 'pending',
        bankStatus: 'Lote não aceito',
        bankStatusCode: 'HA',
        error: 'Lote não aceito',
        errorCode: 'HA',
      },
    ];
  }

  private generateStatusCounts(
    data: IBankStatement[],
  ): Record<string, IBSCounts> {
    const statusCounts: Record<string, IBSCounts> = {};
    for (const item of data) {
      if (!statusCounts?.[item.statusCode]) {
        statusCounts[item.statusCode] = {
          count: 1,
          amountSum: item.amount,
        };
      } else {
        statusCounts[item.statusCode].count += 1;
        statusCounts[item.statusCode].amountSum += item.amount;
      }
    }
    return statusCounts;
  }
}
