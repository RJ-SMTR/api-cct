import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { endOfDay, isToday, startOfDay } from 'date-fns';
import { TransacaoView } from 'src/transacao-bq/transacao-view.entity';
import { TransacaoViewService } from 'src/transacao-bq/transacao-view.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { getDateNthWeek } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import { logError } from 'src/utils/log-utils';
import {
  PAYMENT_START_WEEKDAY,
  PaymentEndpointType,
  getPaymentDates,
} from 'src/utils/payment-date-utils';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { Between, FindOptionsWhere, In } from 'typeorm';
import { IFetchTicketRevenues } from './interfaces/fetch-ticket-revenues.interface';
import { ITicketRevenue } from './interfaces/ticket-revenue.interface';
import { ITicketRevenuesGroup } from './interfaces/ticket-revenues-group.interface';
import { ITRGetMeGroupedArgs } from './interfaces/tr-get-me-grouped-args.interface';
import { ITRGetMeGroupedResponse } from './interfaces/tr-get-me-grouped-response.interface';
import { ITRGetMeIndividualArgs } from './interfaces/tr-get-me-individual-args.interface';
import { ITRGetMeIndividualResponse } from './interfaces/tr-get-me-individual-response.interface';
import { TicketRevenuesGroup } from './objs/TicketRevenuesGroup';
import { TicketRevenuesRepositoryService as TicketRevenuesRepository } from './ticket-revenues-repository';
import { TicketRevenuesGroups } from './types/ticket-revenues-groups.type';
import * as TicketRevenuesGroupList from './utils/ticket-revenues-groups.utils';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { DetalheAService } from 'src/cnab/service/pagamento/detalhe-a.service';

@Injectable()
export class TicketRevenuesService {
  private logger: Logger = new CustomLogger(TicketRevenuesService.name, {
    timestamp: true,
  });

  constructor(
    private readonly usersService: UsersService,
    private readonly ticketRevenuesRepository: TicketRevenuesRepository,
    private readonly transacaoViewService: TransacaoViewService,
    private readonly detalheAService: DetalheAService,
  ) {}

  /**
   * TODO: refactor - use repository method
   *
   * Service method
   */
  public async getMeGrouped(
    args: ITRGetMeGroupedArgs,
  ): Promise<ITicketRevenuesGroup> {
    // Args
    const user = await this.validateGetMeGrouped(args);

    // Repository tasks
    const { startDate, endDate } = getPaymentDates({
      endpoint: 'ticket-revenues',
      startDateStr: args.startDate,
      endDateStr: args.endDate,
      timeInterval: args.timeInterval,
    });

    // Get data
    const ticketRevenuesResponse: ITicketRevenue[] =
      await this.findTransacaoView({
        cpfCnpj: user.getCpfCnpj(),
        startDate,
        endDate,
      });

    if (ticketRevenuesResponse.length === 0) {
      return new TicketRevenuesGroup().toInterface();
    }
    const detalhesA = await this.detalheAService.findMany({
      itemTransacaoAgrupado: {
        id: In(
          ticketRevenuesResponse.map(
            (i) => i.arquivoPublicacao?.itemTransacao.itemTransacaoAgrupado.id,
          ),
        ),
      },
    });
    const ticketRevenuesGroupSum = this.getGroupSum(
      ticketRevenuesResponse,
      detalhesA,
    );

    return ticketRevenuesGroupSum;
  }

  private async validateGetMeGrouped(args: ITRGetMeGroupedArgs): Promise<User> {
    const user = await this.usersService.getOne({ id: args?.userId });
    return user;
  }

  /**
   * TODO: refactor - use repository method
   *
   * Service method
   */
  public async getMe(
    args: ITRGetMeGroupedArgs,
    pagination: PaginationOptions,
    endpoint: PaymentEndpointType,
  ): Promise<ITRGetMeGroupedResponse> {
    // TODO: set groupBy as validation response
    const user = await this.validateGetMe(args);
    const { startDate, endDate } = getPaymentDates({
      endpoint: endpoint,
      startDateStr: args.startDate,
      endDateStr: args.endDate,
      timeInterval: args.timeInterval,
    });
    const groupBy = args?.groupBy || 'day';

    // Repository tasks
    let ticketRevenuesResponse: ITicketRevenue[] = await this.findTransacaoView(
      { cpfCnpj: user.getCpfCnpj(), startDate, endDate },
    );

    if (ticketRevenuesResponse.length === 0) {
      return {
        startDate: null,
        endDate: null,
        amountSum: 0,
        todaySum: 0,
        count: 0,
        ticketCount: 0,
        data: [],
      };
    }

    const detalhesA = await this.detalheAService.findMany({
      itemTransacaoAgrupado: {
        id: In(
          ticketRevenuesResponse.map(
            (i) => i.arquivoPublicacao?.itemTransacao.itemTransacaoAgrupado.id,
          ),
        ),
      },
    });
    let ticketRevenuesGroups = this.getTicketRevenuesGroups(
      ticketRevenuesResponse,
      groupBy,
      detalhesA,
    );

    if (pagination) {
      const offset = pagination?.limit * (pagination?.page - 1);
      ticketRevenuesGroups = ticketRevenuesGroups.slice(
        offset,
        offset + pagination.limit,
      );
    }

    const transactionValueLastDay = Number(
      ticketRevenuesResponse
        .filter((i) => isToday(new Date(i.processingDateTime)))
        .reduce((sum, i) => sum + (i?.transactionValue || 0), 0)
        .toFixed(2),
    );

    ticketRevenuesResponse = this.ticketRevenuesRepository.removeTodayData(
      ticketRevenuesResponse,
      endDate,
    );
    ticketRevenuesGroups = this.ticketRevenuesRepository.removeTodayData(
      ticketRevenuesGroups,
      endDate,
    );

    const amountSum =
      this.ticketRevenuesRepository.getAmountSum(ticketRevenuesGroups);

    const ticketCount = ticketRevenuesGroups.reduce(
      (sum, i) => sum + i.count,
      0,
    );

    return {
      startDate:
        ticketRevenuesResponse[ticketRevenuesResponse.length - 1]
          ?.processingDateTime || null,
      endDate: ticketRevenuesResponse[0]?.processingDateTime || null,
      amountSum,
      todaySum: transactionValueLastDay,
      count: ticketRevenuesGroups.length,
      ticketCount,
      data: ticketRevenuesGroups,
    };
  }

  private async findTransacaoView(fetchArgs: IFetchTicketRevenues) {
    const betweenDate: FindOptionsWhere<TransacaoView> = {
      datetimeProcessamento: Between(
        fetchArgs?.startDate || new Date(0),
        fetchArgs?.endDate || new Date(),
      ),
    };
    const findOperadora: FindOptionsWhere<TransacaoView> = fetchArgs?.cpfCnpj
      ? { operadoraCpfCnpj: fetchArgs.cpfCnpj }
      : {};
    const findConsorcio: FindOptionsWhere<TransacaoView> = fetchArgs?.cpfCnpj
      ? { consorcioCnpj: fetchArgs.cpfCnpj }
      : {};
    const where: FindOptionsWhere<TransacaoView>[] = [
      {
        ...betweenDate,
        ...findOperadora,
      },
      {
        ...betweenDate,
        ...findConsorcio,
      },
    ];
    const today = new Date();
    if (fetchArgs.getToday) {
      const isTodayDate: FindOptionsWhere<TransacaoView> = {
        datetimeProcessamento: Between(startOfDay(today), endOfDay(today)),
      };
      where.push({
        ...isTodayDate,
        ...findOperadora,
      });
      where.push({
        ...isTodayDate,
        ...findConsorcio,
      });
    }

    return (await this.transacaoViewService.find(where)).map((i) =>
      i.toTicketRevenue(),
    );
  }

  private async validateGetMe(args: ITRGetMeGroupedArgs): Promise<User> {
    const user = await this.usersService.getOne({ id: args?.userId });
    return user;
  }

  private getGroupSum(
    data: ITicketRevenue[],
    detalhesA: DetalheA[],
  ): ITicketRevenuesGroup {
    const METHOD = this.getGroupSum.name;
    const groupSums = this.getTicketRevenuesGroups(data, 'all', detalhesA);
    if (groupSums.length >= 1) {
      if (groupSums.length > 1) {
        logError(
          this.logger,
          'ticketRevenuesGroupSum should have 0-1 items, getting first one.',
          METHOD,
        );
      }
      return groupSums[0];
    } else {
      throw new HttpException(
        {
          details: {
            groupSum: `length should not be 0`,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * TODO: refactor - use it in repository
   *
   * Filter method: ticket-revenues/me
   */
  private getTicketRevenuesGroups(
    ticketRevenues: ITicketRevenue[],
    groupBy: 'day' | 'week' | 'month' | 'all' | string,
    detalhesA: DetalheA[],
  ): ITicketRevenuesGroup[] {
    const result = ticketRevenues.reduce(
      (group: TicketRevenuesGroups, item: ITicketRevenue) => {
        const startWeekday: WeekdayEnum = PAYMENT_START_WEEKDAY;
        const itemDate = new Date(item.processingDateTime);
        const nthWeek = getDateNthWeek(itemDate, startWeekday);
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

        // 'day', default,
        let dateGroup: string | number = item.processingDateTime.slice(0, 10);
        if (groupBy === 'week') {
          dateGroup = nthWeek;
        }
        if (groupBy === 'month') {
          dateGroup = itemDate.toISOString().slice(0, 7);
        }
        if (groupBy === 'all') {
          dateGroup = 'all';
        }

        if (!group[dateGroup]) {
          group[dateGroup] = {
            count: 0,
            date: item.processingDateTime,
            transportTypeCounts: {},
            directionIdCounts: {},
            paymentMediaTypeCounts: {},
            transactionTypeCounts: {},
            transportIntegrationTypeCounts: {},
            stopIdCounts: {},
            stopLatCounts: {},
            stopLonCounts: {},
            transactionValueSum: 0,
            aux_epochWeek: nthWeek,
            aux_groupDateTime: itemDate.toISOString(),
            /** Se encontrar 1 item não pago, muda para falso */
            isPago: true,
            errors: errors,
          };
        } else {
          group[dateGroup].errors = [
            ...new Set([...group[dateGroup].errors, ...errors]),
          ];
        }

        TicketRevenuesGroupList.appendItem(group[dateGroup], item, detalhesA);
        return group;
      },
      {},
    );
    const resultList = Object.keys(result).map(
      (dateGroup) => result[dateGroup],
    );
    return resultList;
  }

  public async getMeIndividual(
    args: ITRGetMeIndividualArgs,
    paginationOptions: PaginationOptions,
  ): Promise<Pagination<ITRGetMeIndividualResponse>> {
    const validArgs = await this.validateGetMeIndividual(args);
    return await this.ticketRevenuesRepository.getMeIndividual(
      validArgs,
      paginationOptions,
    );
  }

  private async validateGetMeIndividual(args: ITRGetMeIndividualArgs): Promise<{
    user: User;
    startDate?: string;
    endDate?: string;
    timeInterval?: TimeIntervalEnum;
  }> {
    const user = await this.usersService.getOne({ id: args?.userId });
    return {
      startDate: args?.startDate,
      endDate: args?.endDate,
      timeInterval: args?.timeInterval as unknown as TimeIntervalEnum,
      user,
    };
  }
}
