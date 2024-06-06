import { Injectable } from '@nestjs/common';
import {
  endOfDay,
  nextFriday,
  startOfDay,
  subDays
} from 'date-fns';
import { DetalheAService } from 'src/cnab/service/pagamento/detalhe-a.service';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { User } from 'src/users/entities/user.entity';
import { getDateYMDString, isPaymentWeekComplete } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { getPagination } from 'src/utils/get-pagination';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { In } from 'typeorm';
import { IBankStatement } from './interfaces/bank-statement.interface';
import { IBSCounts } from './interfaces/bs-counts.interface';
import { IBSGetMePreviousDaysValidArgs } from './interfaces/bs-get-me-previous-days-args.interface';
import { IBSGetMePreviousDaysResponse } from './interfaces/bs-get-me-previous-days-response.interface';

/**
 * Get weekly statements
 */
@Injectable()
export class BankStatementsRepositoryService {
  constructor(
    private readonly ticketRevenuesService: TicketRevenuesService,
    private readonly detalheAService: DetalheAService,
  ) {}

  /**
   * Parâmetros validados:
   * - startDate (não existe, valor = startDate - mesmo dia)
   * - endDate
   * - timeInterval (não usado pelo front - padrão: mesmo dia)
   * - user (obrigatório)
   * - pagination: limit, offset
   *
   * Tarefas:
   * 1. Obter transacaoView no intervalo e filtros
   * 2. Agrupar por dia/semana e somar
   * 3. Retornar o resultado do transacaoView, sem tratamentos.
   */
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

  /**
   * Parâmetros:
   * - endDate
   * - startDate (não existe)
   * - timeInterval (dia/semana)
   * - paginação
   * - previousDays (true?)
   *
   * Requisitos:
   * - Mostra sempre as transações individuais
   * -
   */
  private async buildPreviousDays(validArgs: {
    user: User;
    endDate: string;
    timeInterval?: TimeIntervalEnum;
    paginationArgs?: PaginationOptions;
  }): Promise<Pagination<{ data: IBankStatement[] }>> {
    const pagination = validArgs.paginationArgs
      ? validArgs.paginationArgs
      : { limit: 9999, page: 1 };

    const friday = new Date(validArgs.endDate);
    const qui = startOfDay(subDays(friday, 8));
    const qua = endOfDay(subDays(friday, 2));

    const startDate =
      validArgs?.timeInterval === TimeIntervalEnum.LAST_DAY
        ? new Date(validArgs.endDate)
        : qui;

    const endDate =
      validArgs?.timeInterval === TimeIntervalEnum.LAST_DAY
        ? endOfDay(new Date(validArgs.endDate))
        : qua;

    const revenues = await this.ticketRevenuesService.findTransacaoView({
      startDate: startOfDay(startDate),
      endDate: endOfDay(endDate),
      cpfCnpj: validArgs.user.getCpfCnpj(),
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
      previousDays: true,
    });
    const detalhesA = await this.detalheAService.findMany({
      itemTransacaoAgrupado: {
        id: In(
          revenues.map(
            (i) => i.arquivoPublicacao?.itemTransacao.itemTransacaoAgrupado.id,
          ),
        ),
      },
    });
    const statements = revenues.map((item, index) => {
      const isPago = isPaymentWeekComplete(
        new Date(String(item.processingDateTime)),
      );
      const amount = Number((item.transactionValue || 0).toFixed(2));
      const paidAmount = Number(item.paidValue.toFixed(2));
      const foundDetalhesA = detalhesA.filter(
        (i) =>
          i.itemTransacaoAgrupado.id ===
          item.arquivoPublicacao?.itemTransacao.itemTransacaoAgrupado.id,
      );
      const errors = foundDetalhesA.reduce(
        (l, i) => [
          ...l,
          ...i.ocorrencias
            .filter((j) => !['00', 'BD'].includes(j.code))
            .map((j) => j.message),
        ],
        [],
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
        effectivePaymentDate: isPago
          ? getDateYMDString(
              nextFriday(new Date(String(item.processingDateTime))),
            )
          : null,
        cpfCnpj: validArgs.user.getCpfCnpj(),
        permitCode: validArgs.user.getPermitCode(),
        amount: amount,
        paidAmount: paidAmount,
        status: amount ? (isPago ? 'Pago' : 'A pagar') : null,
        errors,
      } as IBankStatement;
    });
    return getPagination<{ data: IBankStatement[] }>(
      {
        data: statements,
      },
      {
        dataLenght: statements.length,
        maxCount: revenues.length,
      },
      pagination,
    );
  }

  private generateStatusCounts(
    data: IBankStatement[],
  ): Record<string, IBSCounts> {
    const statusCounts: Record<string, IBSCounts> = {};
    for (const item of data) {
      const status = String(item.status);
      if (!statusCounts?.[status]) {
        statusCounts[status] = {
          count: 1,
          amountSum: item.amount,
        };
      } else {
        statusCounts[status].count += 1;
        statusCounts[status].amountSum += item.amount;
      }
    }
    return statusCounts;
  }
}
