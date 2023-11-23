import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { endOfDay, isToday, startOfDay } from 'date-fns';
import {
  BigqueryService,
  BigqueryServiceInstances,
} from 'src/bigquery/bigquery.service';
import { JaeService } from 'src/jae/jae.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { getDateNthWeek } from 'src/utils/date-utils';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import {
  PAYMENT_START_WEEKDAY,
  getPaymentDates,
} from 'src/utils/payment-date-utils';
import { QueryBuilder } from 'src/utils/query-builder/query-builder';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { IFetchTicketRevenues } from './interfaces/fetch-ticket-revenues.interface';
import { ITicketRevenue } from './interfaces/ticket-revenue.interface';
import { ITicketRevenuesGetGrouped } from './interfaces/ticket-revenues-get-grouped.interface';
import { ITicketRevenuesGroup } from './interfaces/ticket-revenues-group.interface';
import { ITicketRevenuesGroupedResponse } from './interfaces/ticket-revenues-grouped-response.interface';
import {
  TRIntegrationTypeMap as IntegrationType,
  TRPaymentTypeMap as PaymentType,
  TRTransactionTypeMap as TransactionType,
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
    private jaeService: JaeService,
  ) {}

  public async getMeGroupedFromUser(
    args: ITicketRevenuesGetGrouped,
    endpoint: string,
  ): Promise<ITicketRevenuesGroup> {
    // Args
    const user = await this.getUser(args);
    const { startDate, endDate } = getPaymentDates(
      endpoint,
      args.startDate,
      args.endDate,
      args.timeInterval,
    );

    // Get data
    let ticketRevenuesResponse: ITicketRevenue[] = [];
    const fetchArgs: IFetchTicketRevenues = {
      permitCode: user.permitCode,
      startDate,
      endDate,
    };
    if (this.jaeService.isPermitCodeExists(user.permitCode)) {
      ticketRevenuesResponse = await this.jaeService.getTicketRevenues(
        fetchArgs,
      );
    } else {
      ticketRevenuesResponse = await this.fetchTicketRevenues(fetchArgs);
    }
    ticketRevenuesResponse = this.mapTicketRevenues(ticketRevenuesResponse);

    if (ticketRevenuesResponse.length === 0) {
      return new TicketRevenuesGroup().toInterface();
    }
    const ticketRevenuesGroupSum = this.getGroupSum(ticketRevenuesResponse);
    console.log({
      message: 'GET GROUPED',
      groupSum: ticketRevenuesGroupSum.transactionValueSum,
      individualSum: Number(
        ticketRevenuesResponse
          .reduce((sum, i) => sum + (i?.transactionValue || 0), 0)
          .toFixed(2),
      ),
    });

    return ticketRevenuesGroupSum;
  }

  public async getMeFromUser(
    args: ITicketRevenuesGetGrouped,
    pagination: IPaginationOptions,
    endpoint: string,
  ): Promise<ITicketRevenuesGroupedResponse> {
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
      permitCode: user.permitCode,
      startDate,
      endDate,
      getToday: GET_TODAY,
    };
    if (this.jaeService.isPermitCodeExists(user.permitCode)) {
      ticketRevenuesResponse = await this.jaeService.getTicketRevenues(
        fetchArgs,
      );
    } else {
      ticketRevenuesResponse = await this.fetchTicketRevenues(fetchArgs);
    }

    ticketRevenuesResponse = this.mapTicketRevenues(ticketRevenuesResponse);

    if (ticketRevenuesResponse.length === 0) {
      return {
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
          'getGroupedFromUser(): ticketRevenuesGroupSum should have 0-1 items, getting first one.',
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

  private async getUser(args: ITicketRevenuesGetGrouped): Promise<User> {
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
    if (!user.permitCode) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            message: 'Maybe your token has expired, try to get a new one',
            user: {
              permitCode: 'fieldIsEmpty',
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

  public getTicketRevenuesGroups(
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
            permitCode: item.permitCode,
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
  ): Promise<ITicketRevenue[]> {
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
    if (args?.permitCode !== undefined) {
      let permitCode = args.permitCode;
      if (permitCode[0] === "'") {
        this.logger.warn(
          "permitCode contains ' character, removing it before query",
        );
        permitCode = permitCode.replace("'", '');
      }
      queryBuilderStr = `permissao = '${permitCode}' AND (${queryBuilderStr})`;
    }

    // Query
    const query =
      `
SELECT
  CAST(data AS STRING) AS partitionDate,
  hora AS processingHour,
  CAST(datetime_transacao AS STRING) AS transactionDateTime,
  CAST(datetime_processamento AS STRING) AS processingDateTime,
  datetime_captura AS captureDateTime,
  modo AS transportType,
  permissao AS permitCode,
  servico AS vehicleService,
  sentido AS directionId,
  id_veiculo AS vehicleId,
  id_cliente AS clientId,
  id_transacao AS transactionId,
  id_tipo_pagamento AS paymentMediaType,
  id_tipo_transacao AS transactionType,
  id_tipo_integracao AS transportIntegrationType,
  id_integracao AS integrationId,
  latitude AS transactionLat,
  longitude AS transactionLon,
  stop_id AS stopId,
  stop_lat AS stopLat,
  stop_lon AS stopLon,
  valor_transacao AS transactionValue,
  versao AS bqDataVersion
FROM \`rj-smtr.br_rj_riodejaneiro_bilhetagem.transacao\`` +
      (queryBuilderStr.length ? `\nWHERE ${queryBuilderStr}` : '') +
      `\nORDER BY data DESC, hora DESC` +
      (args?.limit !== undefined ? `\nLIMIT ${args.limit}` : '') +
      (offset !== undefined ? `\nOFFSET ${offset}` : '');

    const ticketRevenues: ITicketRevenue[] =
      await this.bigqueryService.runQuery(BigqueryServiceInstances.smtr, query);
    return ticketRevenues;
  }

  private mapTicketRevenues(
    ticketRevenues: ITicketRevenue[],
  ): ITicketRevenue[] {
    return ticketRevenues.map((item: ITicketRevenue) => {
      const paymentType = item.paymentMediaType;
      const integrationType = item.transportIntegrationType;
      const transactionType = item.transactionType;
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
        transportType:
          integrationType !== null
            ? IntegrationType?.[integrationType] || integrationType
            : integrationType,
        transactionType:
          transactionType !== null
            ? TransactionType[transactionType] || transactionType
            : transactionType,
      };
    });
  }
}
