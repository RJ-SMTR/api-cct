import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { ITicketRevenuesGetGrouped } from './interfaces/ticket-revenues-get-grouped.interface';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import {
  BigqueryService,
  BigqueryServiceInstances,
} from 'src/bigquery/bigquery.service';
import { IFetchTicketRevenues } from './interfaces/fetch-ticket-revenues.interface';
import { ITicketRevenue } from './interfaces/ticket-revenue.interface';
import { ITicketRevenuesGroup } from './interfaces/ticket-revenues-group.interface';
import { getDateNthWeek } from 'src/utils/date-utils';
import { ITicketRevenuesGroupedResponse } from './interfaces/ticket-revenues-grouped-response.interface';
import {
  PAYMENT_START_WEEKDAY,
  PAYMENT_WEEKDAY,
  getPaymentStartEndDates,
} from 'src/utils/payment-date-utils';
import {
  TicketRevenuesPaymentMediaTypeMap as PaymentType,
  TicketRevenuesTransportIntegrationTypeMap as IntegrationType,
  TicketRevenuesTransactionTypeMap as TransactionType,
} from './maps/ticket-revenues.map';

@Injectable()
export class TicketRevenuesService {
  public readonly DEFAULT_PREVIOUS_DAYS = 30;
  private logger: Logger = new Logger('TicketRevenuesService', {
    timestamp: true,
  });

  constructor(private readonly bigqueryService: BigqueryService) {}

  public async getGroupedFromUser(
    user: User,
    args: ITicketRevenuesGetGrouped,
    pagination: IPaginationOptions,
  ): Promise<ITicketRevenuesGroupedResponse> {
    if (!user.permitCode) {
      throw new HttpException(
        {
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

    const { startDate, endDate } = getPaymentStartEndDates({
      startDateStr: args.startDate,
      endDateStr: args.endDate,
      timeInterval: args.timeInterval,
    });

    // Get data
    const ticketRevenuesResponse = await this.fetchTicketRevenues({
      permitCode: user.permitCode,
      startDate,
      endDate,
    });

    let ticketRevenuesSumGroup: ITicketRevenuesGroup = {
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
        ticketRevenuesGroupSum: ticketRevenuesSumGroup,
        transactionValueLastDay: 0,
      };
    }

    let ticketRevenuesGroups = this.getTicketRevenuesGroups(
      ticketRevenuesResponse,
      'day',
    ).filter((group) => {
      const itemDate: Date = new Date(group.partitionDate);
      return itemDate.getUTCDay() !== PAYMENT_WEEKDAY;
    });
    if (pagination) {
      const offset = pagination?.limit * (pagination?.page - 1);
      ticketRevenuesGroups = ticketRevenuesGroups.slice(
        offset,
        offset + pagination.limit,
      );
    }

    const lastDayTransactionValue =
      ticketRevenuesGroups.length > 0
        ? ticketRevenuesGroups[0].transactionValueSum
        : 0;

    const ticketRevenuesSumGroups = this.getTicketRevenuesGroups(
      ticketRevenuesResponse,
      'all',
    );
    if (ticketRevenuesSumGroups.length === 1) {
      ticketRevenuesSumGroup = ticketRevenuesSumGroups[0];
    }
    if (ticketRevenuesSumGroups.length > 1) {
      this.logger.error(
        'getGroupedFromUser(): ticketRevenuesSumGroups should have 0-1 items',
      );
    }

    return {
      data: ticketRevenuesGroups,
      ticketRevenuesGroupSum: ticketRevenuesSumGroup,
      transactionValueLastDay: lastDayTransactionValue,
    };
  }

  public getTicketRevenuesGroups(
    ticketRevenues: ITicketRevenue[],
    groupBy: 'day' | 'week' | 'all',
  ): ITicketRevenuesGroup[] {
    const result = ticketRevenues.reduce(
      (
        accumulator: Record<string, ITicketRevenuesGroup>,
        item: ITicketRevenue,
      ) => {
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

        if (
          accumulator[dateGroup].transportTypeCounts[
            item.transportType as any
          ] === undefined
        ) {
          accumulator[dateGroup].transportTypeCounts[
            item.transportType as any
          ] = 0;
        }
        if (
          accumulator[dateGroup].directionIdCounts[item.directionId as any] ===
          undefined
        ) {
          accumulator[dateGroup].directionIdCounts[item.directionId as any] = 0;
        }
        if (
          accumulator[dateGroup].paymentMediaTypeCounts[
            item.paymentMediaType as any
          ] === undefined
        ) {
          accumulator[dateGroup].paymentMediaTypeCounts[
            item.paymentMediaType as any
          ] = 0;
        }
        if (
          accumulator[dateGroup].transactionTypeCounts[
            item.transactionType as any
          ] === undefined
        ) {
          accumulator[dateGroup].transactionTypeCounts[
            item.transactionType as any
          ] = 0;
        }
        if (
          accumulator[dateGroup].stopIdCounts[item.stopId as any] === undefined
        ) {
          accumulator[dateGroup].stopIdCounts[item.stopId as any] = 0;
        }
        if (
          accumulator[dateGroup].stopLatCounts[item.stopLat as any] ===
          undefined
        ) {
          accumulator[dateGroup].stopLatCounts[item.stopLat as any] = 0;
        }
        if (
          accumulator[dateGroup].stopLonCounts[item.stopLon as any] ===
          undefined
        ) {
          accumulator[dateGroup].stopLonCounts[item.stopLon as any] = 0;
        }
        if (
          accumulator[dateGroup].transportIntegrationTypeCounts[
            item.transportIntegrationType as any
          ] === undefined
        ) {
          accumulator[dateGroup].transportIntegrationTypeCounts[
            item.transportIntegrationType as any
          ] = 0;
        }

        accumulator[dateGroup].count += 1;
        accumulator[dateGroup].transportTypeCounts[
          item.transportType as any
        ] += 1;
        accumulator[dateGroup].directionIdCounts[item.directionId as any] += 1;
        accumulator[dateGroup].paymentMediaTypeCounts[
          item.paymentMediaType as any
        ] += 1;
        accumulator[dateGroup].transactionTypeCounts[
          item.transactionType as any
        ] += 1;
        accumulator[dateGroup].stopIdCounts[item.stopId as any] += 1;
        accumulator[dateGroup].stopLatCounts[item.stopLat as any] += 1;
        accumulator[dateGroup].stopLonCounts[item.stopLon as any] += 1;
        accumulator[dateGroup].transactionValueSum = Number(
          (
            accumulator[dateGroup].transactionValueSum +
            (item.transactionValue || 0)
          ).toFixed(2),
        );
        accumulator[dateGroup].transportIntegrationTypeCounts[
          item.transportIntegrationType as any
        ] += 1;
        accumulator[dateGroup].paymentMediaTypeCounts[
          item.paymentMediaType as any
        ] += 1;
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
    let argsOffset = args?.offset;
    const qWhere: string[] = [];

    if (args?.offset !== undefined && args.limit === undefined) {
      this.logger.warn(
        "fetchTicketRevenues(): 'offset' is defined but 'limit' is not." +
          " 'offset' will be ignored to prevent query fail",
      );
      argsOffset = undefined;
    }

    if (args?.startDate !== undefined) {
      const startDate = args.startDate.toISOString().slice(0, 10);
      qWhere.push(`DATE(data) >= DATE('${startDate}')`);
    }
    if (args?.endDate !== undefined) {
      const endDate = args.endDate.toISOString().slice(0, 10);
      qWhere.push(`DATE(data) <= DATE('${endDate}')`);
    }

    if (args?.permitCode !== undefined) {
      let permitCode = args.permitCode;
      if (permitCode[0] === "'") {
        this.logger.warn(
          "permitCode contains ' character, removing it before query",
        );
        permitCode = permitCode.replace("'", '');
      }
      qWhere.push(`permissao = '${permitCode}'`);
    }

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
      (qWhere.length > 0 ? `\nWHERE ${qWhere.join(' AND ')}` : '') +
      `\nORDER BY data DESC, hora DESC` +
      (args?.limit !== undefined ? `\nLIMIT ${args.limit}` : '') +
      (argsOffset !== undefined ? `\nOFFSET ${argsOffset}` : '');

    let ticketRevenues: ITicketRevenue[] = await this.bigqueryService.runQuery(
      BigqueryServiceInstances.smtr,
      query,
    );

    ticketRevenues = ticketRevenues.map((item: ITicketRevenue) => {
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

    return ticketRevenues;
  }
}
