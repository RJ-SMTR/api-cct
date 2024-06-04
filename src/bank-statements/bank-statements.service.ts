import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { differenceInDays, subDays } from 'date-fns';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { getDateYMDString } from 'src/utils/date-utils';
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
    const paidSum = Number(
      bsData.statements
        .reduce((sum, item) => sum + item.paidAmount, 0)
        .toFixed(2),
    );
    const ticketCount = bsData.countSum;

    return {
      amountSum,
      paidSum,
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
    // 1. Obter catracadas diárias do TransacaoView
    const transacaoViewDaily = getPaymentDates({
      endpoint: 'ticket-revenues',
      startDateStr: args?.startDate,
      endDateStr: args?.endDate,
      timeInterval: args?.timeInterval,
    });
    const revenuesResponse = await this.ticketRevenuesService.getMe(
      {
        startDate: getDateYMDString(transacaoViewDaily.startDate),
        endDate: getDateYMDString(transacaoViewDaily.endDate),
        userId: args?.user.id,
        groupBy: 'day',
      },
      { limit: 9999, page: 1 },
      'ticket-revenues',
    );

    // 2. Agrupar por semana e somar
    const bankStatementsInterval = getPaymentDates({
      endpoint: 'bank-statements',
      startDateStr: args?.startDate,
      endDateStr: args?.endDate,
      timeInterval: args?.timeInterval,
    });

    const todaySum = revenuesResponse.todaySum;
    let allSum = 0;
    /** Agrupar por semana (7 em 7 dias) ou por dia (1 em 1 dia) */
    const groupBy = args.groupBy === 'week' ? 7 : 1;
    /** Como estamos fazendo slice, temos que equalizar o id de cada item */
    const maxId =
      Math.ceil(
        differenceInDays(
          bankStatementsInterval.endDate,
          bankStatementsInterval.startDate,
        ) / groupBy,
      ) + 1;
    let id = 0;
    const newStatements: IBankStatement[] = [];

    // 2.1 Gerar itens para cada dia/semana, mesmo que não tenha dados
    for (
      let endDate = bankStatementsInterval.endDate;
      endDate >= bankStatementsInterval.startDate;
      endDate = subDays(endDate, groupBy)
    ) {
      const dateInterval =
        args.groupBy === 'week'
          ? getPaymentWeek(endDate)
          : { startDate: endDate, endDate };

      const revenuesWeek = revenuesResponse.data.filter(
        (i) =>
          new Date(i.date) >= dateInterval.startDate &&
          new Date(i.date) <= dateInterval.endDate,
      );
      const weekAmount = revenuesWeek.reduce(
        (sum, i) => sum + i.transactionValueSum,
        0,
      );
      const weekPaidAmount = revenuesWeek.reduce(
        (sum, i) => sum + i.paidValueSum,
        0,
      );
      const isPago =
        revenuesWeek.length > 0 && revenuesWeek.every((i) => i.isPago);
      const errors = [
        ...new Set(revenuesWeek.reduce((l, i) => [...l, ...i.errors], [])),
      ];
      const amount = Number(weekPaidAmount.toFixed(2));
      const paidAmount = Number(weekAmount.toFixed(2));
      newStatements.push({
        id: maxId - id,
        amount,
        paidAmount,
        cpfCnpj: args.user.getCpfCnpj(),
        date: getDateYMDString(endDate),
        effectivePaymentDate: isPago ? getDateYMDString(endDate) : null,
        permitCode: args.user.getPermitCode(),
        status: amount ? (isPago ? 'Pago' : 'A pagar') : null,
        errors: errors,
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
