import { Injectable } from '@nestjs/common';
import { endOfDay, isFriday, nextFriday, nextThursday, startOfDay, subDays } from 'date-fns';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { TicketRevenuesService } from 'src/ticket-revenues/ticket-revenues.service';
import { User } from 'src/users/entities/user.entity';
import { formatDateISODate } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { getPagination } from 'src/utils/get-pagination';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { BankStatementPreviousDaysDTO } from './dtos/bank-statement-previous-days.dto';
import { BankStatementDTO } from './dtos/bank-statement.dto';
import { IBSCounts } from './interfaces/bs-counts.interface';
import { IBSGetMePreviousDaysValidArgs } from './interfaces/bs-get-me-previous-days-args.interface';
import { IBSGetMePreviousDaysResponse } from './interfaces/bs-get-me-previous-days-response.interface';

/**
 * Get weekly statements
 */
@Injectable()
export class BankStatementsRepositoryService {
  constructor(private readonly ticketRevenuesService: TicketRevenuesService) {}

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
  public async getPreviousDays(validArgs: IBSGetMePreviousDaysValidArgs, paginationOptions: PaginationOptions): Promise<Pagination<IBSGetMePreviousDaysResponse>> {
    const previousDays = await this.buildPreviousDays({
      user: validArgs.user,
      endDate: validArgs.endDate,
      timeInterval: validArgs.timeInterval,
      paginationArgs: paginationOptions,
    });
    const statusCounts = this.generateStatusCounts(previousDays.data);
    const toPay = previousDays.data.filter((i) => i.status === 'A pagar' && i.errors.length === 0).reduce((s, i) => s + i.paidAmount, 0);
    const paid = previousDays.data.filter((i) => i.status === 'Pago' && i.errors.length === 0).reduce((s, i) => s + i.paidAmount, 0);
    const pending = previousDays.data.filter((i) => i.errors.length > 0).reduce((s, i) => s + i.paidAmount, 0);

    const response = getPagination<IBSGetMePreviousDaysResponse>(
      {
        data: previousDays.data,
        paidValue: paid,
        pendingValue: pending,
        toPayValue: toPay,
        statusCounts: statusCounts,
      },
      {
        dataLenght: previousDays.data.length,
        maxCount: previousDays.count,
      },
      paginationOptions,
    );
    return response;
  }

  /**
   * Parâmetros:
   * - endDate
   * - timeInterval (dia/semana)
   * - paginação
   *
   * Requisitos:
   * - Mostra sempre as transações individuais
   */
  private async buildPreviousDays(validArgs: {
    user: User; //
    endDate: string;
    timeInterval?: TimeIntervalEnum;
    paginationArgs?: PaginationOptions;
  }): Promise<Pagination<{ data: BankStatementPreviousDaysDTO[] }>> {
    const pagination = validArgs.paginationArgs ? validArgs.paginationArgs : { limit: 9999, page: 1 };

    // LastDay
    const day = new Date(validArgs.endDate);
    let startDate = startOfDay(day);
    let endDate = endOfDay(day);

    // LastWeek
    if (validArgs.timeInterval === TimeIntervalEnum.LAST_WEEK) {
      let friday = startOfDay(day);
      if (!isFriday(friday)) {
        friday = nextFriday(friday);
      }
      const qui = subDays(friday, 8);
      const qua = subDays(friday, 2);
      startDate = qui;
      endDate = qua;
    }

    const revenues = await this.ticketRevenuesService.findManyIndividual({ startDate, endDate, cpfCnpj: [validArgs.user.getCpfCnpj()], previousDays: true });

    // Gerar BankStatements
    const statements = revenues.map((revenue, index) => {
      const isPago = revenue.isPago;
      const amount = Number((revenue.transactionValue || 0).toFixed(2));
      const paidAmount = Number(revenue.paidValue.toFixed(2));
      const ticketCount = 1;
      // const foundDetalhesA = detalhesA.filter((i) => i.itemTransacaoAgrupado.id === item.arquivoPublicacao?.itemTransacao.itemTransacaoAgrupado.id);
      const errors = Ocorrencia.getErrors(revenue.ocorrencias);
      const orderDate = nextThursday(startOfDay(new Date(revenue.processingDateTime)));
      const status = !errors.length ? (amount ? (isPago ? 'Pago' : 'A pagar') : null) : 'Pendente';
      const dataEfetivacao = revenue.dataEfetivacao;
      return new BankStatementPreviousDaysDTO({
        id: index + 1,
        date: formatDateISODate(new Date(String(revenue.processingDateTime))),
        effectivePaymentDate: isPago && dataEfetivacao ? formatDateISODate(new Date(dataEfetivacao)) : null,
        paymentOrderDate: formatDateISODate(orderDate),
        transactionDate: formatDateISODate(new Date(revenue.transactionDateTime)),
        processingDate: formatDateISODate(new Date(revenue.processingDateTime)),
        cpfCnpj: validArgs.user.getCpfCnpj(),
        permitCode: validArgs.user.getPermitCode(),
        amount: amount,
        paidAmount: paidAmount,
        status,
        errors,
        ticketCount,
      });
    });

    return getPagination<{ data: BankStatementPreviousDaysDTO[] }>(
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

  private generateStatusCounts(data: BankStatementDTO[]): Record<string, IBSCounts> {
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
