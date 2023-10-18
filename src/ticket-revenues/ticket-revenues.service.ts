import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { JaeService } from 'src/jae/jae.service';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { IJaeTicketRevenue } from 'src/jae/interfaces/jae-ticket-revenue.interface';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { IJaeTicketRevenueGroup } from 'src/jae/interfaces/jae-ticket-revenue-group.interface';
import { ITicketRevenuesGet } from './interfaces/ticket-revenues-get.interface';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import { TicketRevenuesGroupByEnum } from './enums/ticket-revenues-group-by.enum';
import { ITicketRevenuesGetUngrouped } from './interfaces/ticket-revenues-get-ungrouped.interface';

@Injectable()
export class TicketRevenuesService {
  public readonly DEFAULT_PREVIOUS_DAYS = 30;
  constructor(private readonly jaeService: JaeService) {}

  public async getUngroupedFromUser(
    user: User,
    args: ITicketRevenuesGetUngrouped,
    pagination: IPaginationOptions,
  ): Promise<IJaeTicketRevenue[]> {
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

    // TODO: fetch instead of mockup

    // TODO: get by user.permitCode
    const ticketRevenuesResponse =
      await this.jaeService.getTicketRevenuesMocked();
    if (ticketRevenuesResponse.length === 0) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            permitCode: 'fetchResultNotFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    let filteredData = ticketRevenuesResponse.filter((item) => {
      let previousDays: number = this.DEFAULT_PREVIOUS_DAYS;
      if (args?.previousDays !== undefined) {
        previousDays = args.previousDays;
      }
      const previousDaysDate: Date = new Date(Date.now());
      previousDaysDate.setUTCDate(previousDaysDate.getUTCDate() - previousDays);
      previousDaysDate.setUTCHours(0, 0, 0, 0);

      const todayDate = new Date(Date.now());
      const itemDate: Date = new Date(item.transactionDateTime);
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

      return (
        (hasDateRange && isFromStart && isUntilEnd) ||
        (!hasDateRange &&
          ((hasStartOrEnd && (isFromStart || isUntilEnd)) ||
            (!hasStartOrEnd && isFromPreviousDays)))
      );
    });
    if (pagination) {
      const sliceStart = pagination?.limit * (pagination?.page - 1);
      filteredData = filteredData.slice(
        sliceStart,
        sliceStart + pagination.limit,
      );
    }

    return filteredData;
  }

  private getDaysToAdd(currentWeekday: number, desiredWeekday: number) {
    currentWeekday = (currentWeekday + 7) % 7;
    desiredWeekday = (desiredWeekday + 7) % 7;
    const daysToAdd = (desiredWeekday - currentWeekday + 7) % 7;
    return daysToAdd;
  }

  private getNthEpochWeek(dateInput: Date, startWeekday: number): number {
    const epochDate = new Date(1970, 0, 1);
    epochDate.setDate(
      epochDate.getDate() + this.getDaysToAdd(epochDate.getDay(), startWeekday),
    );
    const millisecondsDifference = dateInput.getTime() - epochDate.getTime();
    const millisecondsInAWeek = 7 * 24 * 60 * 60 * 1000;
    const nthWeekNumber =
      Math.floor(millisecondsDifference / millisecondsInAWeek) + 1;
    return nthWeekNumber;
  }

  public getTicketRevenueGroups(
    ticketRevenues: IJaeTicketRevenue[],
    groupBy: TicketRevenuesGroupByEnum = TicketRevenuesGroupByEnum.WEEK,
    startWeekday: WeekdayEnum = WeekdayEnum.SUNDAY,
  ): IJaeTicketRevenueGroup[] {
    const epochDate = new Date(1970, 0, 1);
    console.log(
      'NTH WEEK:',
      startWeekday,
      epochDate.getDay(),
      this.getDaysToAdd(epochDate.getDay(), startWeekday),
    );
    const result = ticketRevenues.reduce(
      (acc: Record<string, IJaeTicketRevenueGroup>, item) => {
        const nthWeek = this.getNthEpochWeek(
          new Date(item.transactionDateTime),
          startWeekday,
        );
        const dateGroup =
          groupBy === TicketRevenuesGroupByEnum.DAY
            ? item.transactionDateTime.slice(0, 10)
            : nthWeek;
        if (!acc[dateGroup]) {
          acc[dateGroup] = {
            ...item,
            transactionCount: 0,
            transactionValueSum: 0,
            transactionTypeCount: {
              full: 0,
              half: 0,
              free: 0,
            },
            transportIntegrationTypeCount: {
              null: 0,
              van: 0,
              bus_supervia: 0,
            },
            paymentMediaTypeCount: {
              card: 0,
              phone: 0,
            },
            aux_epochWeek: nthWeek,
          };
        }
        acc[dateGroup].transactionCount += 1;
        acc[dateGroup].transactionValueSum += item.transactionValue;
        acc[dateGroup].transactionTypeCount[item.transactionType as any] += 1;
        acc[dateGroup].transportIntegrationTypeCount[
          item.transportIntegrationType as any
        ] += 1;
        acc[dateGroup].paymentMediaTypeCount[item.paymentMediaType as any] += 1;
        return acc;
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
    args: ITicketRevenuesGet,
    pagination: IPaginationOptions,
  ): Promise<IJaeTicketRevenueGroup[]> {
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

    // TODO: fetch instead of mockup

    // TODO: get by user.permitCode
    const ticketRevenuesResponse =
      await this.jaeService.getTicketRevenuesMocked();
    if (ticketRevenuesResponse.length === 0) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            permitCode: 'fetchResultNotFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const ticketRevenuesResponseGroup = this.getTicketRevenueGroups(
      ticketRevenuesResponse,
      args.groupBy,
      args.startWeekday,
    );

    let filteredData = ticketRevenuesResponseGroup.filter((item) => {
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
      const itemDate: Date = new Date(item.transactionDateTime);
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
        if (startDate.getDate() < 7) {
          console.log('Outer start', startDate.getDate());
        }
        const defaultEndDate = new Date(Date.now());
        defaultEndDate.setUTCHours(23, 59, 59, 999);
        startDate = this.getIgnorePreviousWeek(
          startDate,
          endDate || defaultEndDate,
          args.startWeekday,
        );
        startDate.setUTCHours(0, 0, 0, 0);
        if (startDate.getDate() < 7) {
          console.log('Outer end', startDate.getDate());
        }
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
      this.getNthEpochWeek(localEndDate, startWeekday) >
      this.getNthEpochWeek(newStartDate, startWeekday)
    ) {
      const addDays = (startWeekday - startDate.getDay() + 7) % 7;
      newStartDate.setDate(newStartDate.getDate() + addDays);
    }
    return newStartDate;
  }
}
