import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { isToday, startOfDay } from 'date-fns';
import {
  BigqueryService,
  BigqueryServiceInstances,
} from 'src/bigquery/bigquery.service';
import { UsersService } from 'src/users/users.service';
import { getDateNthWeek } from 'src/utils/date-utils';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import {
  PAYMENT_START_WEEKDAY,
  getDateIntervalFromStr,
  getPaymentDateInterval,
} from 'src/utils/payment-date-utils';
import { QueryBuilder } from 'src/utils/query-builder/query-builder';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { IFetchTicketRevenues } from './interfaces/fetch-ticket-revenues.interface';
import { ITicketRevenue } from './interfaces/ticket-revenue.interface';
import { ITicketRevenuesGetGrouped } from './interfaces/ticket-revenues-get-grouped.interface';
import { ITicketRevenuesGroup } from './interfaces/ticket-revenues-group.interface';
import { ITicketRevenuesGroupedResponse } from './interfaces/ticket-revenues-grouped-response.interface';
import {
  TicketRevenuesTransportIntegrationTypeMap as IntegrationType,
  TicketRevenuesPaymentMediaTypeMap as PaymentType,
  TicketRevenuesTransactionTypeMap as TransactionType,
} from './maps/ticket-revenues.map';
import { TicketRevenuesGroupsType } from './types/ticket-revenues-groups.type';
import * as TicketRevenuesGroups from './utils/ticket-revenues-groups.utils';

@Injectable()
export class TicketRevenuesService {
  private logger: Logger = new Logger('TicketRevenuesService', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryService: BigqueryService,
    private readonly usersService: UsersService,
  ) {}

  public async getGroupedFromUser(
    args: ITicketRevenuesGetGrouped,
    pagination: IPaginationOptions,
  ): Promise<ITicketRevenuesGroupedResponse> {
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

    console.log({ arg: args?.userId, user });

    const getToday = true;
    const useTimeInterval = args?.startDate === undefined;
    const { startDate, endDate } = !useTimeInterval
      ? getDateIntervalFromStr({
          startDateStr: args.startDate,
          endDateStr: args.endDate,
        })
      : getPaymentDateInterval(args.timeInterval);

    // Get data
    let ticketRevenuesResponse = await this.fetchTicketRevenues({
      permitCode: user.permitCode,
      startDate,
      endDate,
      getToday,
    });
    ticketRevenuesResponse = this.mapTicketRevenuesEnums(
      ticketRevenuesResponse,
    );

    let ticketRevenuesGroupSum: ITicketRevenuesGroup = {
      count: 0,
      partitionDate: '',
      transportTypeCounts: {},
      permitCode: '',
      directionIdCounts: {},
      paymentMediaTypeCounts: {},
      transactionTypeCounts: {},
      transportIntegrationTypeCounts: {},
      stopIdCounts: {},
      stopLatCounts: {},
      stopLonCounts: {},
      transactionValueSum: 0,
      aux_epochWeek: 0,
      aux_groupDateTime: '',
    };

    if (ticketRevenuesResponse.length === 0) {
      return {
        data: [],
        ticketRevenuesGroupSum: ticketRevenuesGroupSum,
        transactionValueLastDay: 0,
      };
    }

    let ticketRevenuesGroups = this.getTicketRevenuesGroups(
      ticketRevenuesResponse,
      'day',
    );

    if (pagination) {
      const offset = pagination?.limit * (pagination?.page - 1);
      ticketRevenuesGroups = ticketRevenuesGroups.slice(
        offset,
        offset + pagination.limit,
      );
    }

    const transactionValueLastDay =
      ticketRevenuesGroups.length > 0
        ? ticketRevenuesGroups[0].transactionValueSum
        : 0;

    const mostRecentResponseDate = startOfDay(
      new Date(ticketRevenuesResponse[0].partitionDate),
    );
    if (getToday && mostRecentResponseDate > startOfDay(endDate)) {
      ticketRevenuesResponse = this.removeTicketRevenueToday(
        ticketRevenuesResponse,
      ) as ITicketRevenue[];
      ticketRevenuesGroups = this.removeTicketRevenueToday(
        ticketRevenuesGroups,
      ) as ITicketRevenuesGroup[];
    }

    const ticketRevenuesSumGroups = this.getTicketRevenuesGroups(
      ticketRevenuesResponse,
      'all',
    );
    if (ticketRevenuesSumGroups.length === 1) {
      ticketRevenuesGroupSum = ticketRevenuesSumGroups[0];
    }
    if (ticketRevenuesSumGroups.length > 1) {
      this.logger.error(
        'getGroupedFromUser(): ticketRevenuesSumGroups should have 0-1 items',
      );
    }

    return {
      data: ticketRevenuesGroups,
      ticketRevenuesGroupSum,
      transactionValueLastDay,
    };
  }

  public removeTicketRevenueToday(
    list: (ITicketRevenue | ITicketRevenuesGroup)[],
  ): ITicketRevenue[] | (ITicketRevenue | ITicketRevenuesGroup)[] {
    return list.filter((i) => !isToday(new Date(i.partitionDate)));
  }

  public getTicketRevenuesGroups(
    ticketRevenues: ITicketRevenue[],
    groupBy: 'day' | 'week' | 'all',
  ): ITicketRevenuesGroup[] {
    const result = ticketRevenues.reduce(
      (accumulator: TicketRevenuesGroupsType, item: ITicketRevenue) => {
        const startWeekday: WeekdayEnum = PAYMENT_START_WEEKDAY;
        const itemDate = new Date(item.partitionDate);
        const nthWeek = getDateNthWeek(itemDate, startWeekday);
        let dateGroup: string | number = item.partitionDate; // 'day', default,
        if (groupBy === 'week') {
          dateGroup = nthWeek;
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

        TicketRevenuesGroups.appendItem(accumulator[dateGroup], item, true);
        return accumulator;
      },
      {},
    );
    const resultList = Object.keys(result).map(
      (dateGroup) => result[dateGroup],
    );
    return resultList;
  }

  public async fetchTicketRevenues(
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

    if (args?.permitCode !== undefined) {
      let permitCode = args.permitCode;
      if (permitCode[0] === "'") {
        this.logger.warn(
          "permitCode contains ' character, removing it before query",
        );
        permitCode = permitCode.replace("'", '');
      }
      queryBuilder.pushAND(`permissao = '${permitCode}'`);
    }

    queryBuilder.pushOR([]);
    if (args?.getToday) {
      const nowStr = new Date(Date.now()).toISOString().slice(0, 10);
      queryBuilder.pushAND(`DATE(data) = DATE('${nowStr}')`);
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
      (queryBuilder.getQueryBuild() ? `\nWHERE ${queryBuilder.toSQL()}` : '') +
      `\nORDER BY data DESC, hora DESC` +
      (args?.limit !== undefined ? `\nLIMIT ${args.limit}` : '') +
      (offset !== undefined ? `\nOFFSET ${offset}` : '');

    const ticketRevenues: ITicketRevenue[] =
      await this.bigqueryService.runQuery(BigqueryServiceInstances.smtr, query);
    return ticketRevenues;
  }

  public mapTicketRevenuesEnums(
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
        transactionType:
          transactionType !== null
            ? TransactionType[transactionType] || transactionType
            : transactionType,
      };
    });
  }
}
