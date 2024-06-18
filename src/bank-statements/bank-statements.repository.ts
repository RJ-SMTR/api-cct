import { Injectable } from '@nestjs/common';
import {
  endOfMonth,
  isFriday,
  nextFriday,
  nextThursday,
  previousFriday,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';
import { DetalheAService } from 'src/cnab/service/pagamento/detalhe-a.service';
import { TransacaoViewService } from 'src/transacao-bq/transacao-view.service';
import { User } from 'src/users/entities/user.entity';
import { getDateYMDString } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { getPagination } from 'src/utils/get-pagination';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { In } from 'typeorm';
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
  constructor(
    private readonly transacaoViewService: TransacaoViewService,
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
    const toPay = previousDays.data
      .filter((i) => i.status === 'A pagar' && i.errors.length === 0)
      .reduce((s, i) => s + i.paidAmount, 0);
    const paid = previousDays.data
      .filter((i) => i.status === 'Pago' && i.errors.length === 0)
      .reduce((s, i) => s + i.paidAmount, 0);
    const pending = previousDays.data
      .filter((i) => i.errors.length > 0)
      .reduce((s, i) => s + i.paidAmount, 0);

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
   * -
   */
  private async buildPreviousDays(validArgs: {
    user: User;
    endDate: string;
    timeInterval?: TimeIntervalEnum;
    paginationArgs?: PaginationOptions;
  }): Promise<Pagination<{ data: BankStatementPreviousDaysDTO[] }>> {
    const pagination = validArgs.paginationArgs
      ? validArgs.paginationArgs
      : { limit: 9999, page: 1 };

    // LastMonth
    const day = new Date(validArgs.endDate);
    let startFriday = startOfMonth(startOfDay(day));
    if (!isFriday(startFriday)) {
      startFriday = nextFriday(startFriday);
    }
    let endFriday = endOfMonth(day);
    if (!isFriday(endFriday)) {
      endFriday = previousFriday(endFriday);
    }
    const qui = subDays(startFriday, 8);
    const qua = subDays(endFriday, 2);

    const transacoes = await this.transacaoViewService.findPreviousDays({
      startDate: qui,
      endDate: qua,
      cpfCnpjs: [validArgs.user.getCpfCnpj()],
    });
    const revenues = transacoes.map((i) => i.toTicketRevenue());
    const detalhesA = await this.detalheAService.findMany({
      itemTransacaoAgrupado: {
        id: In(
          revenues.map(
            (i) => i.arquivoPublicacao?.itemTransacao.itemTransacaoAgrupado.id,
          ),
        ),
      },
    });

    // Gerar BankStatements
    const statements = revenues.map((item, index) => {
      const isPago = item.arquivoPublicacao?.isPago;
      const amount = Number((item.transactionValue || 0).toFixed(2));
      const paidAmount = Number(item.paidValue.toFixed(2));
      const ticketCount = 1;
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
      const orderDate = nextThursday(
        startOfDay(new Date(item.processingDateTime)),
      );
      const dataEfetivacao = item.arquivoPublicacao?.dataEfetivacao;
      return new BankStatementPreviousDaysDTO({
        id: index + 1,
        date: getDateYMDString(new Date(String(item.processingDateTime))),
        effectivePaymentDate:
          isPago && dataEfetivacao
            ? getDateYMDString(new Date(dataEfetivacao))
            : null,
        paymentOrderDate: getDateYMDString(orderDate),
        transactionDate: getDateYMDString(new Date(item.transactionDateTime)),
        processingDate: getDateYMDString(new Date(item.processingDateTime)),
        cpfCnpj: validArgs.user.getCpfCnpj(),
        permitCode: validArgs.user.getPermitCode(),
        amount: amount,
        paidAmount: paidAmount,
        status: amount ? (isPago ? 'Pago' : 'A pagar') : null,
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

  private generateStatusCounts(
    data: BankStatementDTO[],
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
