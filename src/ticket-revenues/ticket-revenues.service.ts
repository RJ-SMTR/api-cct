import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { ITicketRevenuesGetGrouped } from './interfaces/ticket-revenues-get-grouped.interface';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import { TicketRevenuesGroupByEnum } from './enums/ticket-revenues-group-by.enum';
import { ITicketRevenuesGetUngrouped } from './interfaces/ticket-revenues-get-ungrouped.interface';
import {
  BigqueryService,
  BigqueryServiceInstances,
} from 'src/bigquery/bigquery.service';
import { IFetchTicketRevenues } from './interfaces/fetch-ticket-revenues.interface';
import { ITicketRevenue } from './interfaces/ticket-revenue.interface';
import { ITicketRevenuesGroup } from './interfaces/ticket-revenues-group.interface';
import { getDateNthWeek } from 'src/utils/date-utils';

@Injectable()
export class TicketRevenuesService {
  public readonly DEFAULT_PREVIOUS_DAYS = 30;
  private logger: Logger = new Logger('TicketRevenuesService', {
    timestamp: true,
  });

  constructor(private readonly bigqueryService: BigqueryService) {}

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

    if (args?.previousDays !== undefined) {
      const previousDaysDate: Date = new Date(Date.now());
      previousDaysDate.setUTCDate(
        previousDaysDate.getUTCDate() - args.previousDays,
      );
      qWhere.push(
        `DATE(data) >= DATE('${previousDaysDate.toISOString().split('T')[0]}')`,
      );
    } else {
      if (args?.startDate !== undefined) {
        qWhere.push(`DATE(data) >= DATE('${args.startDate}')`);
      }
      if (args?.endDate !== undefined) {
        qWhere.push(`DATE(data) <= DATE('${args.endDate}')`);
      }
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

    const ticketRevenues: ITicketRevenue[] =
      await this.bigqueryService.runQuery(
        BigqueryServiceInstances.smtr,
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
          (argsOffset !== undefined ? `\nOFFSET ${argsOffset}` : ''),
      );

    return ticketRevenues;
  }

  public async getUngroupedFromUser(
    user: User,
    args: ITicketRevenuesGetUngrouped,
    pagination: IPaginationOptions,
  ): Promise<ITicketRevenue[]> {
    const pageOffsetStart = pagination.limit * (pagination.page - 1);
    const pageOffsetEnd = pageOffsetStart + pagination.limit;

    if (!user.permitCode) {
      throw new HttpException(
        {
          details: {
            message: 'maybe your token has expired, try to get a new one',
            user: {
              permitCode: 'fieldIsEmpty',
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Fetch
    const ticketRevenuesResponse = await this.fetchTicketRevenues({
      permitCode: user.permitCode,
      ...(args.startDate && { startDate: args.startDate }),
      ...(args.endDate && { endDate: args.endDate }),
      ...(args.previousDays && { previousDays: args.previousDays }),
      limit: pagination.limit,
      offset: pageOffsetStart,
    });
    if (ticketRevenuesResponse.length === 0) {
      this.logger.debug(
        'getUngroupedFromUser(): aborted because fetch got no results for permitCode.',
      );
      return [];
    }
    console.log('LEN', ticketRevenuesResponse.length);

    // Filter
    let filteredData = ticketRevenuesResponse.filter((item) => {
      let previousDays: number = this.DEFAULT_PREVIOUS_DAYS;
      if (args?.previousDays !== undefined) {
        previousDays = args.previousDays;
      }
      const previousDaysDate: Date = new Date(Date.now());
      previousDaysDate.setUTCDate(previousDaysDate.getUTCDate() - previousDays);
      previousDaysDate.setUTCHours(0, 0, 0, 0);

      const todayDate = new Date(Date.now());
      const itemDate: Date = new Date(item.partitionDate);
      const startDate: Date | null = args?.startDate
        ? new Date(args.startDate)
        : null;
      const endDate: Date | null = args?.endDate
        ? new Date(args.endDate)
        : null;
      if (endDate !== null) {
        endDate.setUTCHours(23, 59, 59, 999);
      }

      const hasDateRange = Boolean(args?.startDate && args?.endDate);
      const hasStartOrEnd = Boolean(args?.startDate || args?.endDate);
      const isFromStart = startDate && itemDate >= startDate;
      const isUntilEnd = endDate && itemDate <= endDate;
      const isFromPreviousDays =
        previousDaysDate &&
        itemDate >= previousDaysDate &&
        itemDate <= todayDate;
      const isValidData =
        (hasDateRange && isFromStart && isUntilEnd) ||
        (!hasDateRange &&
          ((hasStartOrEnd && (isFromStart || isUntilEnd)) ||
            (!hasStartOrEnd && isFromPreviousDays)));
      return isValidData;
    });

    // Pagination
    if (pagination) {
      filteredData = filteredData.slice(pageOffsetStart, pageOffsetEnd);
    }

    return filteredData;
  }

  public getTicketRevenuesGroups(
    ticketRevenues: ITicketRevenue[],
    groupBy: TicketRevenuesGroupByEnum = TicketRevenuesGroupByEnum.WEEK,
    startWeekday: WeekdayEnum = WeekdayEnum._6_SUNDAY,
  ): ITicketRevenuesGroup[] {
    const result = ticketRevenues.reduce(
      (
        accumulator: Record<string, ITicketRevenuesGroup>,
        item: ITicketRevenue,
      ) => {
        const itemDate = new Date(item.partitionDate);
        const nthWeek = getDateNthWeek(itemDate, startWeekday);
        const dateGroup =
          groupBy === TicketRevenuesGroupByEnum.DAY
            ? item.partitionDate
            : nthWeek;

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

  public async getGroupedFromUser(
    user: User,
    args: ITicketRevenuesGetGrouped,
    pagination: IPaginationOptions,
  ): Promise<ITicketRevenuesGroup[]> {
    if (!user.permitCode) {
      throw new HttpException(
        {
          details: {
            message: 'maybe your token has expired, try to get a new one',
            user: {
              permitCode: 'fieldIsEmpty',
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Get data
    const ticketRevenuesResponse = await this.fetchTicketRevenues({
      permitCode: user.permitCode,
      ...(args.startDate && { startDate: args.startDate }),
      ...(args.endDate && { endDate: args.endDate }),
      ...(args.previousDays && { previousDays: args.previousDays }),
    });

    if (ticketRevenuesResponse.length === 0) {
      this.logger.debug(
        'getGroupedFromUser(): aborted because fetch got no results for permitCode.',
      );
      return [];
    }

    const ticketRevenuesGroups = this.getTicketRevenuesGroups(
      ticketRevenuesResponse,
      args.groupBy,
      args.startWeekday,
    );

    // Filter data
    let filteredData = ticketRevenuesGroups.filter((group) => {
      let previousDays: number = this.DEFAULT_PREVIOUS_DAYS;
      if (args?.previousDays !== undefined) {
        previousDays = args.previousDays;
      }
      let previousDaysDate: Date = new Date(Date.now());
      previousDaysDate.setUTCDate(previousDaysDate.getUTCDate() - previousDays);
      previousDaysDate.setUTCHours(0, 0, 0, 0);
      if (args.ignorePreviousWeek) {
        previousDaysDate = this.getIgnorePreviousWeek(
          previousDaysDate,
          new Date(Date.now()),
          args.startWeekday,
        );
      }
      previousDaysDate.setUTCHours(0, 0, 0, 0);

      const todayDate = new Date(Date.now());
      const itemDate: Date = new Date(group.partitionDate);
      let startDate: Date | null = args?.startDate
        ? new Date(args.startDate)
        : null;
      const endDate: Date | null = args?.endDate
        ? new Date(args.endDate)
        : null;
      if (endDate !== null) {
        endDate.setUTCHours(23, 59, 59, 999);
      }
      if (args.ignorePreviousWeek && startDate !== null) {
        const defaultEndDate = new Date(Date.now());
        defaultEndDate.setUTCHours(23, 59, 59, 999);
        startDate = this.getIgnorePreviousWeek(
          startDate,
          endDate || defaultEndDate,
          args.startWeekday,
        );
        startDate.setUTCHours(0, 0, 0, 0);
      }

      const hasDateRange = Boolean(args?.startDate && args?.endDate);
      const hasStartOrEnd = Boolean(args?.startDate || args?.endDate);
      const isFromStart = startDate && itemDate >= startDate;
      const isUntilEnd = endDate && itemDate <= endDate;
      const isFromPreviousDays =
        previousDaysDate &&
        itemDate >= previousDaysDate &&
        itemDate <= todayDate;

      return (
        (hasDateRange && isFromStart && isUntilEnd) ||
        (!hasDateRange &&
          ((hasStartOrEnd && (isFromStart || isUntilEnd)) ||
            (!hasStartOrEnd && isFromPreviousDays)))
      );
    });

    // Pagination
    if (pagination) {
      const sliceStart = pagination?.limit * (pagination?.page - 1);
      filteredData = filteredData.slice(
        sliceStart,
        sliceStart + pagination.limit,
      );
    }

    return filteredData;
  }

  private getIgnorePreviousWeek(
    startDate: Date,
    endDate: Date,
    startWeekday: number,
  ): Date {
    const newStartDate = new Date(startDate);
    const localEndDate = new Date(endDate);
    if (
      getDateNthWeek(localEndDate, startWeekday) >
      getDateNthWeek(newStartDate, startWeekday)
    ) {
      const addDays = (startWeekday - startDate.getDay() + 7) % 7;
      newStartDate.setDate(newStartDate.getDate() + addDays);
    }
    return newStartDate;
  }
}
