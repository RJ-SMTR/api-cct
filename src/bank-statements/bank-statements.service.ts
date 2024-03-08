import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { differenceInDays, subDays } from 'date-fns';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { getDateYMDString, isPaymentWeekComplete } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { getPaymentDates, getPaymentWeek } from 'src/utils/payment-date-utils';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { BankStatementsRepositoryService } from './bank-statements-repository.service';
import { IBankStatement } from './interfaces/bank-statement.interface';
import { IBSGetMeArgs } from './interfaces/bs-get-me-args.interface';
import {
  IBSGetMePreviousDaysArgs,
  IBSGetMePreviousDaysValidArgs,
} from './interfaces/bs-get-me-previous-days-args.interface';
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
    private readonly bankStatementsRepository: BankStatementsRepositoryService,
    private readonly ticketRevenuesService: TicketRevenuesService,
  ) {}

  public async getMe(args: IBSGetMeArgs): Promise<IBSGetMeResponse> {
    const validArgs = await this.validateGetMe(args);
    let todaySum = 0;
    const bsData = await this.generateBankStatements({
      groupBy: 'week',
      startDate: validArgs.startDate,
      endDate: validArgs.endDate,
      timeInterval: validArgs.timeInterval,
      user: validArgs.user,
    });
    todaySum = bsData.todaySum;
    const amountSum = Number(
      bsData.statements.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
    );
    const ticketCount = bsData.countSum;

    return {
      amountSum,
      todaySum,
      count: bsData.statements.length,
      ticketCount,
      data: bsData.statements,
    };
  }

  private async validateGetMe(args: IBSGetMeArgs): Promise<{
    startDate?: string;
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

    // For now it validates if user exists
    const user = await this.usersService.getOne({ id: args?.userId });

    return {
      startDate: args?.startDate,
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
      const isPaid = isPaymentWeekComplete(subDays(endDate, 2));
      newStatements.push({
        id: maxId - id,
        amount: Number(weekAmount.toFixed(2)),
        cpfCnpj: args.user.getCpfCnpj(),
        date: getDateYMDString(endDate),
        processingDate: getDateYMDString(endDate),
        transactionDate: getDateYMDString(endDate),
        paymentOrderDate: getDateYMDString(endDate),
        effectivePaymentDate: isPaid ? getDateYMDString(endDate) : null,
        permitCode: args.user.getPermitCode(),
        status: isPaid ? 'Pago' : 'A pagar',
        statusCode: isPaid ? 'paid' : 'toPay',
        bankStatus: isPaid ? '00' : null,
        bankStatusCode: isPaid ? 'Crédito ou Débito Efetivado' : null,
        error: null,
        errorCode: null,
      });
      allSum += Number(weekAmount.toFixed(2));
      id += 1;
    }
    const countSum = revenuesResponse.ticketCount;
    return { todaySum, allSum, countSum, statements: newStatements };
  }

  public async getMePreviousDays(
    args: IBSGetMePreviousDaysArgs,
    paginationOptions: PaginationOptions,
  ): Promise<Pagination<IBSGetMePreviousDaysResponse>> {
    const validArgs = await this.validateGetMePreviousDays(args);
    return await this.bankStatementsRepository.getPreviousDays(
      validArgs,
      paginationOptions,
    );
  }

  /**
   * TODO: refactor
   *
   * Service: previous-days
   */
  private async validateGetMePreviousDays(
    args: IBSGetMePreviousDaysArgs,
  ): Promise<IBSGetMePreviousDaysValidArgs> {
    if (isNaN(args?.userId as number)) {
      throw CommonHttpException.argNotType('userId', 'number', args?.userId);
    }
    const user = await this.usersService.getOne({ id: args?.userId });
    if (!args?.endDate) {
    }
    return {
      user: user,
      endDate: args.endDate || getDateYMDString(new Date(Date.now())),
      timeInterval: args.timeInterval as unknown as TimeIntervalEnum,
    };
  }
}
