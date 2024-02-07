import { Injectable } from '@nestjs/common';
import { nextFriday } from 'date-fns';
import { TicketRevenuesRepositoryService } from 'src/ticket-revenues/ticket-revenues-repository.service';
import { User } from 'src/users/entities/user.entity';
import { getDateYMDString, isPaymentWeekComplete } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { getPagination } from 'src/utils/get-pagination';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { IBankStatement } from './interfaces/bank-statement.interface';
import { IBSCounts } from './interfaces/bs-counts.interface';
import { IBSGetMePreviousDaysValidArgs } from './interfaces/bs-get-me-previous-days-args.interface';
import { IBSGetMePreviousDaysResponse } from './interfaces/bs-get-me-previous-days-response.interface';
import { IBSGetMeDayValidArgs } from './interfaces/bs-get-me-day-args.interface';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';

/**
 * Get weekly statements
 */
@Injectable()
export class BankStatementsRepositoryService {
  constructor(
    private readonly ticketRevenuesRepository: TicketRevenuesRepositoryService,
    private readonly ticketRevenuesService: TicketRevenuesService,
  ) {}

  public async getPreviousDays(
    validArgs: IBSGetMePreviousDaysValidArgs,
    paginationOptions: PaginationOptions,
  ): Promise<Pagination<IBSGetMePreviousDaysResponse>> {
    const previousDays = await this.buildPreviousDays({
      user: validArgs.user,
      endDate: validArgs.endDate,
      timeInterval: validArgs.timeInterval,
      paginationArgs: paginationOptions,
    });
    const statusCounts = this.generateStatusCounts(previousDays.data);

    return getPagination<IBSGetMePreviousDaysResponse>(
      {
        data: previousDays.data,
        statusCounts: statusCounts,
      },
      {
        dataLenght: previousDays.data.length,
        maxCount: previousDays.count,
      },
      paginationOptions,
    );
  }

  private async buildPreviousDays(validArgs: {
    user: User;
    endDate: string;
    timeInterval?: TimeIntervalEnum;
    paginationArgs?: PaginationOptions;
  }): Promise<Pagination<{ data: IBankStatement[] }>> {
    const pagination = validArgs.paginationArgs
      ? validArgs.paginationArgs
      : { limit: 9999, page: 1 };
    const revenues = await this.ticketRevenuesRepository.fetchTicketRevenues({
      startDate: new Date(validArgs.endDate),
      endDate: new Date(validArgs.endDate),
      cpfCnpj: validArgs.user.getCpfCnpj(),
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
      previousDays: true,
    });
    const statements = revenues.data.map((item, index) => {
      const isPaid = isPaymentWeekComplete(
        new Date(String(item.processingDateTime)),
      );
      return {
        id: index,
        date: getDateYMDString(new Date(String(item.processingDateTime))),
        processingDate: getDateYMDString(
          new Date(String(item.processingDateTime)),
        ),
        transactionDate: getDateYMDString(
          new Date(String(item.transactionDateTime)),
        ),
        paymentOrderDate: getDateYMDString(
          nextFriday(new Date(String(item.processingDateTime))),
        ),
        effectivePaymentDate: isPaid
          ? getDateYMDString(
              nextFriday(new Date(String(item.processingDateTime))),
            )
          : null,
        cpfCnpj: validArgs.user.getCpfCnpj(),
        permitCode: validArgs.user.getPermitCode(),
        amount: item.transactionValue,
        status: isPaid ? 'Pago' : 'A pagar',
        statusCode: isPaid ? 'paid' : 'toPay',
        bankStatus: isPaid ? '00' : null,
        bankStatusCode: isPaid ? 'Crédito ou Débito Efetivado' : null,
        error: null,
        errorCode: null,
      } as IBankStatement;
    });
    return getPagination<{ data: IBankStatement[] }>(
      {
        data: statements,
      },
      {
        dataLenght: statements.length,
        maxCount: revenues.countAll,
      },
      pagination,
    );
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

  async getMeDay(validArgs: IBSGetMeDayValidArgs): Promise<number> {
    const revenues = await this.ticketRevenuesService.getMe(
      {
        startDate: validArgs.endDate,
        endDate: validArgs.endDate,
        userId: validArgs.user.id,
        groupBy: 'day',
      },
      { limit: 9999, page: 1 },
      'ticket-revenues',
    );
    return revenues.amountSum;
  }
}
