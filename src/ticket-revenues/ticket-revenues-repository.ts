import { Injectable, Logger } from '@nestjs/common';
import { endOfDay, isToday, startOfDay } from 'date-fns';
import { TransacaoView } from 'src/transacao-bq/transacao-view.entity';
import { TransacaoViewService } from 'src/transacao-bq/transacao-view.service';
import { getPagination } from 'src/utils/get-pagination';
import { getPaymentDates } from 'src/utils/payment-date-utils';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { Between, FindOptionsWhere, In } from 'typeorm';
import { TicketRevenueDTO } from './dtos/ticket-revenue.dto';
import { TicketRevenuesGroupDto } from './dtos/ticket-revenues-group.dto';
import { IFetchTicketRevenues } from './interfaces/fetch-ticket-revenues.interface';
import { ITRGetMeIndividualValidArgs } from './interfaces/tr-get-me-individual-args.interface';
import { ITRGetMeIndividualResponse } from './interfaces/tr-get-me-individual-response.interface';
import { ArquivoPublicacaoService } from 'src/cnab/service/arquivo-publicacao.service';

@Injectable()
export class TicketRevenuesRepositoryService {
  private logger: Logger = new Logger('TicketRevenuesRepository', {
    timestamp: true,
  });

  constructor(private readonly transacaoViewService: TransacaoViewService, private arquivoPublicacaoService: ArquivoPublicacaoService) {}

  /**
   * TODO: use it only for repository services
   *
   * Filter: used by:
   * - ticket-revenues/get/me
   */
  removeTodayData<T extends TicketRevenueDTO | TicketRevenuesGroupDto>(data: T[], endDate: Date): T[] {
    const mostRecentDate = startOfDay(new Date(data[0].date));
    if (mostRecentDate > endOfDay(endDate)) {
      return data.filter((i) => !isToday(new Date(i.date)));
    } else {
      return data;
    }
  }

  public async getMeIndividual(validArgs: ITRGetMeIndividualValidArgs, paginationArgs: PaginationOptions): Promise<Pagination<ITRGetMeIndividualResponse>> {
    const { startDate, endDate } = getPaymentDates({
      endpoint: 'ticket-revenues',
      startDateStr: validArgs.startDate,
      endDateStr: validArgs.endDate,
      timeInterval: validArgs.timeInterval,
    });

    const revenues = await this.findTransacaoView(startDate, endDate, validArgs);
    const paidSum = +revenues
      .filter((i) => i.isPago)
      .reduce((s, i) => s + i.paidValue, 0)
      .toFixed(2);
    const countAll = revenues.length;
    let ticketRevenuesResponse = revenues;

    if (ticketRevenuesResponse.length === 0) {
      return getPagination<ITRGetMeIndividualResponse>(
        {
          amountSum: 0,
          paidSum: 0,
          data: [],
        },
        {
          dataLenght: 0,
          maxCount: 0,
        },
        paginationArgs,
      );
    }

    ticketRevenuesResponse = this.removeTodayData(ticketRevenuesResponse, endDate);

    return getPagination<ITRGetMeIndividualResponse>(
      {
        paidSum,
        amountSum: this.getAmountSum(ticketRevenuesResponse),
        data: ticketRevenuesResponse,
      },
      {
        dataLenght: ticketRevenuesResponse.length,
        maxCount: countAll,
      },
      paginationArgs,
    );
  }

  private async findTransacaoView(startDate: Date, endDate: Date, validArgs: ITRGetMeIndividualValidArgs) {
    const fetchArgs: IFetchTicketRevenues = {
      cpfCnpj: validArgs.user.getCpfCnpj(),
      startDate,
      endDate,
      getToday: true,
    };

    const betweenDate: FindOptionsWhere<TransacaoView> = {
      datetimeProcessamento: Between(fetchArgs.startDate as Date, fetchArgs.endDate as Date),
    };
    const where: FindOptionsWhere<TransacaoView>[] = [
      {
        ...betweenDate,
        operadoraCpfCnpj: validArgs.user.getCpfCnpj(),
      },
      {
        ...betweenDate,
        consorcioCnpj: validArgs.user.getCpfCnpj(),
      },
    ];
    const today = new Date();
    if (fetchArgs.getToday) {
      const isTodayDate: FindOptionsWhere<TransacaoView> = {
        datetimeProcessamento: Between(startOfDay(today), endOfDay(today)),
      };
      where.push({
        ...isTodayDate,
        operadoraCpfCnpj: validArgs.user.getCpfCnpj(),
      });
      where.push({
        ...isTodayDate,
        consorcioCnpj: validArgs.user.getCpfCnpj(),
      });
    }

    const transacaoViews = await this.transacaoViewService.find(where);
    const publicacoes = await this.arquivoPublicacaoService.findMany({ where: { itemTransacao: { itemTransacaoAgrupado: { id: In(transacaoViews.map((t) => t.itemTransacaoAgrupadoId)) } } } });
    const revenues = transacaoViews.map((i) => i.toTicketRevenue(publicacoes));
    return revenues;
  }

  /**
   * Apenas soma se status = pago
   */
  getAmountSum<T extends TicketRevenueDTO | TicketRevenuesGroupDto>(data: T[]): number {
    return +data.reduce((sum, i) => sum + this.getTransactionValue(i), 0).toFixed(2);
  }

  private getTransactionValue(item: TicketRevenueDTO | TicketRevenuesGroupDto): number {
    if ('transactionValue' in item) {
      return item.transactionValue || 0;
    } else if ('transactionValueSum' in item) {
      return item.transactionValueSum || 0;
    } else {
      return 0;
    }
  }
}
