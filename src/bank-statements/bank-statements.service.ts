import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  differenceInDays,
  endOfDay,
  endOfMonth,
  isFriday,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { getDateYMDString } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { getPaymentDates, getPaymentWeek } from 'src/utils/payment-date-utils';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { BankStatementsRepositoryService } from './bank-statements.repository';
import { BSMePrevDaysTimeIntervalEnum } from './enums/bs-me-prev-days-time-interval.enum';
import { BankStatementDTO } from './dtos/bank-statement.dto';
import { IBSGetMeArgs } from './interfaces/bs-get-me-args.interface';
import {
  IBSGetMePreviousDaysArgs,
  IBSGetMePreviousDaysValidArgs,
} from './interfaces/bs-get-me-previous-days-args.interface';
import { IBSGetMePreviousDaysResponse } from './interfaces/bs-get-me-previous-days-response.interface';
import { IGetBSResponse } from './interfaces/get-bs-response.interface';
import { IBSGetMeResponse } from './interfaces/bs-get-me-response.interface';

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

  /**
   * - startDate
   * - endDate
   * - timeInterval (lastMonth)
   * - user (mandatory)
   *
   * Tasks:
   * 1. Validar argumentos
   * 2. Obter transacaoView no intervalo e filtros
   * 3. Agrupar por dia/semana e somar
   * 4. Reteornar variáveis a partir do próprio resultado do transacaoView.
   */
  public async getMe(args: IBSGetMeArgs): Promise<IBSGetMeResponse> {
    const validArgs = await this.validateGetMe(args);
    const bsData = await this.generateBankStatements({
      groupBy: 'week',
      startDate: validArgs.startDate,
      endDate: validArgs.endDate,
      timeInterval: validArgs.timeInterval,
      user: validArgs.user,
    });
    const amountSum = Number(
      bsData.statements.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
    );
    const paidSum = Number(
      bsData.statements
        .reduce((sum, item) => sum + item.paidAmount, 0)
        .toFixed(2),
    );
    const ticketCount = bsData.countSum;

    const todaySum = bsData.todaySum;
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

    // convert timeInterval into start/endDates

    return {
      timeInterval: args?.timeInterval,
      startDate: startOfMonth(
        startOfDay(new Date(args.yearMonth)),
      ).toISOString(),
      endDate: endOfMonth(endOfDay(new Date(args.yearMonth))).toISOString(),
      user: user,
    };
  }

  /**
   * Get grouped bank statements
   * @throws `HttpException`
   *
   * - groupBy
   * - startDate
   * - endDate
   * - timeInterval
   * - user (mandatory)
   *
   * Tasks:
   * 1. Obter transacaoView no intervalo e filtros
   * 2. agrupar por dia/semana e somar
   *
   * Requisitos:
   * - Cada semana exibe os valores de qui-qua
   * - Não exibir semanas futuras
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
      { limit: 100, page: 1 },
      'bank-statements>ticket-revenues',
    );

    // 2. Agrupar por semana e somar
    const fridays = getPaymentDates({
      endpoint: 'bank-statements',
      startDateStr: args?.startDate,
      endDateStr: args?.endDate,
      timeInterval: args?.timeInterval,
    });
    // const quiQuaInterval = {
    //   startDate: subDays(fridays.startDate, 8),
    //   endDate: subDays(fridays.endDate, 2),
    // }

    const todaySum = revenuesResponse.todaySum;
    let allSum = 0;
    /** Agrupar por semana (7 em 7 dias) ou por dia (1 em 1 dia) */
    const groupBy = args.groupBy === 'week' ? 7 : 1;
    /** Como estamos fazendo slice, temos que equalizar o id de cada item */
    const maxId =
      Math.ceil(
        differenceInDays(fridays.endDate, fridays.startDate) / groupBy,
      ) + 1;
    let id = 0;
    const newStatements: BankStatementDTO[] = [];

    // 2.1 Gerar itens para cada dia/semana, mesmo que não tenha dados (qui-qua por semana)
    for (
      let endDate = fridays.endDate;
      endDate >= fridays.startDate;
      endDate = subDays(endDate, groupBy)
    ) {
      /** Se for semanal, pega de qui-qua */
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
      /** Se todos os itens não vazios foram pagos */
      const isPago =
        revenuesWeek.length > 0 &&
        revenuesWeek.filter((i) => i.count).every((i) => i.isPago);
      const errors = [
        ...new Set(revenuesWeek.reduce((l, i) => [...l, ...i.errors], [])),
      ];
      const amount = Number(weekAmount.toFixed(2));
      const paidAmount = Number(weekPaidAmount.toFixed(2));
      const ticketCount = revenuesWeek.reduce((s, i) => s + i.count, 0);
      newStatements.push(
        new BankStatementDTO({
          id: maxId - id,
          amount,
          paidAmount,
          cpfCnpj: args.user.getCpfCnpj(),
          date: getDateYMDString(endDate),
          effectivePaymentDate: isPago ? getDateYMDString(endDate) : null,
          permitCode: args.user.getPermitCode(),
          status: amount ? (isPago ? 'Pago' : 'A pagar') : null,
          errors: errors,
          ticketCount,
        }),
      );
      allSum += Number(weekAmount.toFixed(2));
      id += 1;
    }
    const countSum = revenuesResponse.ticketCount;
    return { todaySum, allSum, countSum, statements: newStatements };
  }

  // #region getMePreviousDays

  /**
   * - endDate
   * - timeInterval (lastDay, lastWeek)
   * - user (obrigatório)
   * - pagination: limit, offset
   *
   * Tarefas:
   * 1. Validar argumentos
   * 2. Obter transacaoView no intervalo e filtros
   * 3. Agrupar por dia/semana e somar
   * 4. Retornar o resultado do transacaoView, sem tratamentos.
   *
   * @param args.timeInterval
   * `lastDay`: recebe o dia e retorna os dias anteriores desse dia
   * `lastMonth`: recebe uma sexta-feira e retorna os dias de qui-qua dessa semana de pagamento.
   *  Se não for sexta-feira, reotrna erro.
   */
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

  private async validateGetMePreviousDays(
    args: IBSGetMePreviousDaysArgs,
  ): Promise<IBSGetMePreviousDaysValidArgs> {
    if (isNaN(args?.userId as number)) {
      throw CommonHttpException.argNotType('userId', 'number', args?.userId);
    }
    const user = await this.usersService.getOne({ id: args?.userId });

    // Se filtrar pela última semana o endDate deve ser sexta-feira
    if (
      args?.timeInterval === BSMePrevDaysTimeIntervalEnum.LAST_WEEK &&
      (!args?.endDate || !isFriday(new Date(args.endDate)))
    ) {
      throw CommonHttpException.message(
        'timeInterval = `lastWeek` mas endDate não é sexta-feira.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return {
      user: user,
      endDate: args.endDate || getDateYMDString(new Date(Date.now())),
      timeInterval: args.timeInterval as unknown as TimeIntervalEnum,
    };
  }

  // #endregion
}
