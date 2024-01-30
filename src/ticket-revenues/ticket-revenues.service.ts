import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { endOfDay, isToday, startOfDay } from 'date-fns';
import { BQSInstances, BigqueryService } from 'src/bigquery/bigquery.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { getDateNthWeek } from 'src/utils/date-utils';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import { formatLog } from 'src/utils/logging';
import { getPagination } from 'src/utils/get-pagination';
import {
  PAYMENT_START_WEEKDAY,
  PaymentEndpointType,
  getPaymentDates,
} from 'src/utils/payment-date-utils';
import { QueryBuilder } from 'src/utils/query-builder/query-builder';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { IFetchTicketRevenues } from './interfaces/fetch-ticket-revenues.interface';
import { ITicketRevenue } from './interfaces/ticket-revenue.interface';
import { ITicketRevenuesGroup } from './interfaces/ticket-revenues-group.interface';
import { ITRGetMeGroupedArgs } from './interfaces/tr-get-me-grouped-args.interface';
import { ITRGetMeGroupedResponse } from './interfaces/tr-get-me-grouped-response.interface';
import { ITRGetMeIndividualArgs } from './interfaces/tr-get-me-individual-args.interface';
import { ITRGetMeIndividualResponse } from './interfaces/tr-get-me-individual-response.interface';
import {
  TRIntegrationTypeMap as IntegrationType,
  TRPaymentTypeMap as PaymentType,
} from './maps/ticket-revenues.map';
import { TicketRevenuesGroup } from './objs/TicketRevenuesGroup';
import { TicketRevenuesGroupsType } from './types/ticket-revenues-groups.type';
import * as TicketRevenuesGroupList from './utils/ticket-revenues-groups.utils';

@Injectable()
export class TicketRevenuesService {
  private logger: Logger = new Logger('TicketRevenuesService', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryService: BigqueryService,
    private readonly usersService: UsersService,
  ) {}

  public async getMeGrouped(
    args: ITRGetMeGroupedArgs,
  ): Promise<ITicketRevenuesGroup> {
    // Args
    const user = await this.getUser(args);
    const { startDate, endDate } = getPaymentDates(
      'ticket-revenues',
      args.startDate,
      args.endDate,
      args.timeInterval,
    );

    // Get data
    let ticketRevenuesResponse: ITicketRevenue[] = [];
    const fetchArgs: IFetchTicketRevenues = {
      cpfCnpj: user.cpfCnpj,
      startDate,
      endDate,
    };

    ticketRevenuesResponse = (await this.fetchTicketRevenues(fetchArgs))
      .ticketRevenuesResponse;
    ticketRevenuesResponse = this.mapTicketRevenues(ticketRevenuesResponse);

    if (ticketRevenuesResponse.length === 0) {
      return new TicketRevenuesGroup().toInterface();
    }
    const ticketRevenuesGroupSum = this.getGroupSum(ticketRevenuesResponse);

    return ticketRevenuesGroupSum;
  }

  public async getMe(
    args: ITRGetMeGroupedArgs,
    pagination: IPaginationOptions,
    endpoint: PaymentEndpointType,
  ): Promise<ITRGetMeGroupedResponse> {
    const user = await this.getUser(args);
    const GET_TODAY = true;
    const { startDate, endDate } = getPaymentDates(
      endpoint,
      args.startDate,
      args.endDate,
      args.timeInterval,
    );
    const groupBy = args?.groupBy || 'day';

    // Get data
    let ticketRevenuesResponse: ITicketRevenue[] = [];
    const fetchArgs: IFetchTicketRevenues = {
      cpfCnpj: user.cpfCnpj,
      startDate,
      endDate,
      getToday: GET_TODAY,
    };

    ticketRevenuesResponse = (await this.fetchTicketRevenues(fetchArgs))
      .ticketRevenuesResponse;

    ticketRevenuesResponse = this.mapTicketRevenues(ticketRevenuesResponse);

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

    let ticketRevenuesGroups = this.getTicketRevenuesGroups(
      ticketRevenuesResponse,
      groupBy,
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
        .filter((i) => isToday(new Date(i.partitionDate)))
        .reduce((sum, i) => sum + (i?.transactionValue || 0), 0)
        .toFixed(2),
    );

    const mostRecentResponseDate = startOfDay(
      new Date(ticketRevenuesResponse[0].partitionDate),
    );
    if (GET_TODAY && mostRecentResponseDate > endOfDay(endDate)) {
      ticketRevenuesResponse = this.removeTicketRevenueToday(
        ticketRevenuesResponse,
      ) as ITicketRevenue[];
      ticketRevenuesGroups = this.removeTicketRevenueToday(
        ticketRevenuesGroups,
      ) as ITicketRevenuesGroup[];
    }

    const amountSum = Number(
      ticketRevenuesGroups
        .reduce((sum, i) => sum + (i?.transactionValueSum || 0), 0)
        .toFixed(2),
    );

    const ticketCount = ticketRevenuesGroups.reduce(
      (sum, i) => sum + i.count,
      0,
    );

    return {
      startDate:
        ticketRevenuesResponse[ticketRevenuesResponse.length - 1].partitionDate,
      endDate: ticketRevenuesResponse[0].partitionDate,
      amountSum,
      todaySum: transactionValueLastDay,
      count: ticketRevenuesGroups.length,
      ticketCount,
      data: ticketRevenuesGroups,
    };
  }

  private getGroupSum(data: ITicketRevenue[]): ITicketRevenuesGroup {
    const groupSums = this.getTicketRevenuesGroups(data, 'all');
    if (groupSums.length >= 1) {
      if (groupSums.length > 1) {
        this.logger.error(
          formatLog(
            'ticketRevenuesGroupSum should have 0-1 items, getting first one.',
            `${this.getMeGrouped.name}() -> ${this.getGroupSum.name}()`,
          ),
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

  private async getUser(args: ITRGetMeGroupedArgs): Promise<User> {
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
    const user = await this.usersService.getOne({ id: args?.userId });
    if (!user.cpfCnpj) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            message: 'Maybe your token has expired, try to get a new one',
            user: {
              cpfCnpj: 'fieldIsEmpty',
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return user;
  }

  private removeTicketRevenueToday(
    list: (ITicketRevenue | ITicketRevenuesGroup)[],
  ): ITicketRevenue[] | (ITicketRevenue | ITicketRevenuesGroup)[] {
    return list.filter((i) => !isToday(new Date(i.partitionDate)));
  }

  private getTicketRevenuesGroups(
    ticketRevenues: ITicketRevenue[],
    groupBy: 'day' | 'week' | 'month' | 'all' | string,
  ): ITicketRevenuesGroup[] {
    const result = ticketRevenues.reduce(
      (accumulator: TicketRevenuesGroupsType, item: ITicketRevenue) => {
        const startWeekday: WeekdayEnum = PAYMENT_START_WEEKDAY;
        const itemDate = new Date(item.partitionDate);
        const nthWeek = getDateNthWeek(itemDate, startWeekday);

        // 'day', default,
        let dateGroup: string | number = item.partitionDate;
        if (groupBy === 'week') {
          dateGroup = nthWeek;
        }
        if (groupBy === 'month') {
          dateGroup = itemDate.toISOString().slice(0, 7);
        }
        if (groupBy === 'all') {
          dateGroup = 'all';
        }

        if (!accumulator[dateGroup]) {
          accumulator[dateGroup] = {
            count: 0,
            partitionDate: item.partitionDate,
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
          };
        }

        TicketRevenuesGroupList.appendItem(accumulator[dateGroup], item);
        return accumulator;
      },
      {},
    );
    const resultList = Object.keys(result).map(
      (dateGroup) => result[dateGroup],
    );
    return resultList;
  }

  private async fetchTicketRevenues(
    args?: IFetchTicketRevenues,
  ): Promise<{ ticketRevenuesResponse: ITicketRevenue[]; countAll: number }> {
    // Args
    let offset = args?.offset;
    const queryBuilder = new QueryBuilder();
    queryBuilder.pushOR([]);
    if (args?.offset !== undefined && args.limit === undefined) {
      this.logger.warn(
        "fetchTicketRevenues(): 'offset' is defined but 'limit' is not." +
          " 'offset' will be ignored to prevent query fail",
      );
      offset = undefined;
    }

    if (args?.startDate !== undefined) {
      const startDate = args.startDate.toISOString().slice(0, 10);
      queryBuilder.pushAND(`DATE(data) >= DATE('${startDate}')`);
    }
    if (args?.endDate !== undefined) {
      const endDate = args.endDate.toISOString().slice(0, 10);
      queryBuilder.pushAND(`DATE(data) <= DATE('${endDate}')`);
    }

    queryBuilder.pushOR([]);
    if (args?.getToday) {
      const nowStr = new Date(Date.now()).toISOString().slice(0, 10);
      queryBuilder.pushAND(`DATE(data) = DATE('${nowStr}')`);
    }

    let queryBuilderStr = queryBuilder.toSQL();
    if (args?.cpfCnpj !== undefined) {
      const cpfCnpj = args.cpfCnpj;
      queryBuilderStr = `o.documento = '${cpfCnpj}' AND (${queryBuilderStr})`;
    }

    // Query
    const query =
      `
      SELECT
        CAST(t.data AS STRING) AS partitionDate,
        t.hora AS processingHour,
        CAST(t.datetime_transacao AS STRING) AS transactionDateTime,
        CAST(t.datetime_processamento AS STRING) AS processingDateTime,
        t.datetime_captura AS captureDateTime,
        t.modo AS transportType,
        t.servico AS vehicleService,
        t.sentido AS directionId,
        t.id_veiculo AS vehicleId,
        t.id_cliente AS clientId,
        t.id_transacao AS transactionId,
        t.id_tipo_pagamento AS paymentMediaType,
        t.tipo_transacao AS transactionType,
        t.id_tipo_integracao AS transportIntegrationType,
        t.id_integracao AS integrationId,
        t.latitude AS transactionLat,
        t.longitude AS transactionLon,
        t.stop_id AS stopId,
        t.stop_lat AS stopLat,
        t.stop_lon AS stopLon,
        t.valor_transacao AS transactionValue,
        t.versao AS bqDataVersion
      FROM \`rj-smtr.br_rj_riodejaneiro_bilhetagem.transacao\` t
      LEFT JOIN \`rj-smtr.cadastro.operadoras\` o ON o.id_operadora = t.id_operadora` +
      ' ' +
      (queryBuilderStr.length ? `\nWHERE ${queryBuilderStr}` : '') +
      `\nORDER BY data DESC, hora DESC` +
      (args?.limit !== undefined ? `\nLIMIT ${args.limit}` : '') +
      (offset !== undefined ? `\nOFFSET ${offset}` : '');

    const ticketRevenues: ITicketRevenue[] =
      await this.bigqueryService.runQuery(BQSInstances.smtr, query);

    const countQuery =
      `
    SELECT COUNT(*) AS count
    FROM \`rj-smtr.br_rj_riodejaneiro_bilhetagem.transacao\` t
    LEFT JOIN \`rj-smtr.cadastro.operadoras\` o ON o.id_operadora = t.id_operadora ` +
      (queryBuilderStr.length ? `\nWHERE ${queryBuilderStr}` : '');
    const countAll: number = (
      await this.bigqueryService.runQuery(BQSInstances.smtr, countQuery)
    )[0].count;
    return { ticketRevenuesResponse: ticketRevenues, countAll };
  }

  /**
   * Convert id values into string values
   */
  private mapTicketRevenues(
    ticketRevenues: ITicketRevenue[],
  ): ITicketRevenue[] {
    return ticketRevenues.map((item: ITicketRevenue) => {
      const paymentType = item.paymentMediaType;
      const integrationType = item.transportIntegrationType;
      return {
        ...item,
        paymentMediaType:
          paymentType !== null
            ? PaymentType?.[paymentType] || paymentType
            : paymentType,
        transportIntegrationType:
          integrationType !== null
            ? IntegrationType?.[integrationType] || integrationType
            : integrationType,
      };
    });
  }

  public async getMeIndividual(
    args: ITRGetMeIndividualArgs,
    paginationArgs: IPaginationOptions,
  ): Promise<Pagination<ITRGetMeIndividualResponse>> {
    const GET_TODAY = true;
    const validArgs = await this.validateGetMeIndividualArgs(args);
    const { startDate, endDate } = getPaymentDates(
      'ticket-revenues',
      validArgs.startDate,
      validArgs.endDate,
      validArgs.timeInterval,
    );

    const result = await this.fetchTicketRevenues({
      cpfCnpj: validArgs.user.getCpfCnpj(),
      startDate,
      endDate,
      getToday: GET_TODAY,
      limit: paginationArgs.limit,
      offset: (paginationArgs.page - 1) * paginationArgs.limit,
    });
    let ticketRevenuesResponse = result.ticketRevenuesResponse;

    ticketRevenuesResponse = this.mapTicketRevenues(ticketRevenuesResponse);

    if (ticketRevenuesResponse.length === 0) {
      return getPagination<ITRGetMeIndividualResponse>(
        {
          amountSum: 0,
          data: [],
        },
        {
          dataLenght: 0,
          maxCount: 0,
        },
        paginationArgs,
      );
    }

    const mostRecentResponseDate = startOfDay(
      new Date(ticketRevenuesResponse[0].partitionDate),
    );
    if (GET_TODAY && mostRecentResponseDate > endOfDay(endDate)) {
      ticketRevenuesResponse = this.removeTicketRevenueToday(
        ticketRevenuesResponse,
      ) as ITicketRevenue[];
    }

    return getPagination<ITRGetMeIndividualResponse>(
      {
        amountSum: this.getAmountSum(ticketRevenuesResponse),
        data: ticketRevenuesResponse,
      },
      {
        dataLenght: ticketRevenuesResponse.length,
        maxCount: result.countAll,
      },
      paginationArgs,
    );
  }

  private getAmountSum(data: ITicketRevenue[]): number {
    return Number(
      data.reduce((sum, i) => sum + (i?.transactionValue || 0), 0).toFixed(2),
    );
  }

  private async validateGetMeIndividualArgs(
    args: ITRGetMeIndividualArgs,
  ): Promise<{
    user: User;
    startDate?: string;
    endDate?: string;
    timeInterval?: TimeIntervalEnum;
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
    const user = await this.usersService.getOne({ id: args?.userId });
    if (!user.cpfCnpj) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            message: 'Maybe your token has expired, try to get a new one',
            user: {
              cpfCnpj: 'fieldIsEmpty',
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return {
      startDate: args?.startDate,
      endDate: args?.endDate,
      timeInterval: args?.timeInterval as unknown as TimeIntervalEnum,
      user,
    };
  }
}
