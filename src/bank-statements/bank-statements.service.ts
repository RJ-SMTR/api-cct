import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { differenceInDays, endOfDay, endOfMonth, startOfDay, startOfMonth, subDays } from 'date-fns';
import { CnabService } from 'src/cnab/cnab.service';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { formatDateISODate } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { getPaymentDates, getPaymentWeek } from 'src/utils/payment-date-utils';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { BankStatementsRepositoryService } from './bank-statements.repository';
import { BankStatementDTO } from './dtos/bank-statement.dto';
import { BSMePrevDaysTimeIntervalEnum } from './enums/bs-me-prev-days-time-interval.enum';
import { IBSGetMeArgs } from './interfaces/bs-get-me-args.interface';
import { IBSGetMePreviousDaysArgs, IBSGetMePreviousDaysValidArgs } from './interfaces/bs-get-me-previous-days-args.interface';
import { IBSGetMePreviousDaysResponse } from './interfaces/bs-get-me-previous-days-response.interface';
import { IBSGetMeResponse } from './interfaces/bs-get-me-response.interface';
import { IGetBSResponse } from './interfaces/get-bs-response.interface';

/**
 * Get weekly statements
 */
@Injectable()
export class BankStatementsService {
  constructor(
    private readonly usersService: UsersService, //
    private readonly bankStatementsRepository: BankStatementsRepositoryService,
    private readonly ticketRevenuesService: TicketRevenuesService,
    private readonly cnabService: CnabService,
  ) {}

  /**
   * - startDate
   * - endDate
   * - timeInterval (lastMonth)
   * - user (mandatory)
   *
   * 1. Validar argumentos
   * 2. Obter transacaoView no intervalo e filtros
   * 3. Agrupar por dia/semana e somar
   * 4. Reteornar variáveis a partir do próprio resultado do transacaoView.
   */
  public async getMe(args: IBSGetMeArgs): Promise<IBSGetMeResponse> {
    const validArgs = await this.validateGetMe(args);
    await this.cnabService.syncTransacaoViewOrdemPgto({
      nomeFavorecido: [validArgs.user.getFullName()],
      consorcio: { in: ['STPC', 'STPL'] },
    });
    const bsData = await this.generateBankStatements({
      groupBy: 'week',
      startDate: validArgs.startDate,
      endDate: validArgs.endDate,
      timeInterval: validArgs.timeInterval,
      user: validArgs.user,
    });
    const amountSum = +bsData.statements.reduce((sum, item) => sum + item.amount, 0).toFixed(2);
    const paidSum = +bsData.statements
      .filter((i) => i.status === 'Pago')
      .reduce((sum, item) => sum + item.paidAmount, 0)
      .toFixed(2);
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
      throw new HttpException({ details: { userId: `field is ${args?.userId}` } }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const user = await this.usersService.getOne({ id: args?.userId });

    // convert timeInterval into start/endDates

    return {
      timeInterval: args?.timeInterval,
      startDate: startOfMonth(startOfDay(new Date(args.yearMonth))).toISOString(),
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
  private async generateBankStatements(args: { groupBy: 'day' | 'week'; startDate?: string; endDate?: string; timeInterval?: TimeIntervalEnum; user: User }): Promise<IGetBSResponse> {
    // 1. Obter catracadas diárias do TransacaoView
    const transacaoViewDaily = getPaymentDates({
      endpoint: 'ticket-revenues',
      startDateStr: args?.startDate,
      endDateStr: args?.endDate,
      timeInterval: args?.timeInterval,
    });
    const revenuesResponse = await this.ticketRevenuesService.getMe(
      {
        startDate: formatDateISODate(transacaoViewDaily.startDate),
        endDate: formatDateISODate(transacaoViewDaily.endDate),
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
    const maxId = Math.ceil(differenceInDays(fridays.endDate, fridays.startDate) / groupBy) + 1;
    let id = 0;
    const newStatements: BankStatementDTO[] = [];

    // 2.1 Gerar itens para cada dia/semana, mesmo que não tenha dados (qui-qua por semana)
    for (let endDate = fridays.endDate; endDate >= fridays.startDate; endDate = subDays(endDate, groupBy)) {
      /** Se for semanal, pega de qui-qua */
      const dateInterval = args.groupBy === 'week' ? getPaymentWeek(endDate) : { startDate: endDate, endDate };

      const revenuesWeek = revenuesResponse.data.filter((i) => new Date(i.date) >= dateInterval.startDate && new Date(i.date) <= dateInterval.endDate);
      const weekAmount = revenuesWeek.reduce((sum, i) => sum + i.transactionValueSum, 0);
      const weekToPayAmount = revenuesWeek.reduce((sum, i) => sum + i.paidValueSum, 0);
      /** Se todos os itens não vazios e com valor foram pagos */
      const nonEmptyRevenues = revenuesWeek.filter((i) => (i.transactionValueSum || i.paidValueSum) && i.count);
      const isPago = nonEmptyRevenues.length > 0 && nonEmptyRevenues.every((i) => i.isPago === true);
      const errors = [...new Set(revenuesWeek.reduce((l, i) => [...l, ...i.errors], []))];
      const amount = Number(weekAmount.toFixed(2));
      const paidAmount = Number(weekToPayAmount.toFixed(2));
      const ticketCount = revenuesWeek.reduce((s, i) => s + i.count, 0);
      const status = !errors.length ? (amount || paidAmount ? (isPago ? 'Pago' : 'A pagar') : null) : 'Pendente';
      const newStatement = new BankStatementDTO({
        id: maxId - id,
        amount,
        paidAmount,
        cpfCnpj: args.user.getCpfCnpj(),
        date: formatDateISODate(endDate),
        effectivePaymentDate: isPago ? formatDateISODate(endDate) : null,
        permitCode: args.user.getPermitCode(),
        status,
        errors: errors,
        ticketCount,
      });
      newStatements.push(newStatement);
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
  public async getMePreviousDays(args: IBSGetMePreviousDaysArgs, paginationOptions: PaginationOptions): Promise<Pagination<IBSGetMePreviousDaysResponse>> {
    const validArgs = await this.validateGetMePreviousDays(args);
    return await this.bankStatementsRepository.getPreviousDays(validArgs, paginationOptions);
  }

  private async validateGetMePreviousDays(args: IBSGetMePreviousDaysArgs): Promise<IBSGetMePreviousDaysValidArgs> {
    if (isNaN(args?.userId as number)) {
      throw CommonHttpException.argNotType('userId', 'number', args?.userId);
    }
    const user = await this.usersService.getOne({ id: args?.userId });

    // O filtro mensal sempre retorna start/end dates
    if (args?.timeInterval === BSMePrevDaysTimeIntervalEnum.LAST_WEEK && !args?.endDate) {
      throw CommonHttpException.message('timeInterval = `lastWeek` mas endDate não foi enviado.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    return {
      user: user,
      endDate: args.endDate || formatDateISODate(new Date(Date.now())),
      timeInterval: args.timeInterval as unknown as TimeIntervalEnum,
    };
  }

  // #endregion
}
