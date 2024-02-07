import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { isToday } from 'date-fns';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { getDateNthWeek } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import { formatLog } from 'src/utils/logging';
import {
  PAYMENT_START_WEEKDAY,
  PaymentEndpointType,
  getPaymentDates,
} from 'src/utils/payment-date-utils';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { IFetchTicketRevenues } from './interfaces/fetch-ticket-revenues.interface';
import { ITicketRevenue } from './interfaces/ticket-revenue.interface';
import { ITicketRevenuesGroup } from './interfaces/ticket-revenues-group.interface';
import { ITRGetMeGroupedArgs } from './interfaces/tr-get-me-grouped-args.interface';
import { ITRGetMeGroupedResponse } from './interfaces/tr-get-me-grouped-response.interface';
import { ITRGetMeIndividualArgs } from './interfaces/tr-get-me-individual-args.interface';
import { ITRGetMeIndividualResponse } from './interfaces/tr-get-me-individual-response.interface';
import { TicketRevenuesGroup } from './objs/TicketRevenuesGroup';
import { TicketRevenuesRepositoryService } from './ticket-revenues-repository.service';
import { TicketRevenuesGroupsType } from './types/ticket-revenues-groups.type';
import * as TicketRevenuesGroupList from './utils/ticket-revenues-groups.utils';

@Injectable()
export class TicketRevenuesService {
  private logger: Logger = new Logger('TicketRevenuesService', {
    timestamp: true,
  });

  constructor(
    private readonly usersService: UsersService,
    private readonly ticketRevenuesRepository: TicketRevenuesRepositoryService,
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
    const fetchArgs: IFetchTicketRevenues = {
      cpfCnpj: user.getCpfCnpj(),
      startDate,
      endDate,
    };

    const ticketRevenuesResponse: ITicketRevenue[] = (
      await this.ticketRevenuesRepository.fetchTicketRevenues(fetchArgs)
    ).data;

    if (ticketRevenuesResponse.length === 0) {
      return new TicketRevenuesGroup().toInterface();
    }
    const ticketRevenuesGroupSum = this.getGroupSum(ticketRevenuesResponse);

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
    let ticketRevenuesResponse: ITicketRevenue[] = [];
    const fetchArgs: IFetchTicketRevenues = {
      cpfCnpj: user.getCpfCnpj(),
      startDate,
      endDate,
      getToday: true,
    };

    ticketRevenuesResponse = (
      await this.ticketRevenuesRepository.fetchTicketRevenues(fetchArgs)
    ).data;

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
          ?.partitionDate || null,
      endDate: ticketRevenuesResponse[0]?.partitionDate || null,
      amountSum,
      todaySum: transactionValueLastDay,
      count: ticketRevenuesGroups.length,
      ticketCount,
      data: ticketRevenuesGroups,
    };
  }

  private async validateGetMe(args: ITRGetMeGroupedArgs): Promise<User> {
    const user = await this.usersService.getOne({ id: args?.userId });
    return user;
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

  /**
   * TODO: refactor - use it in repository
   *
   * Filter method: ticket-revenues/me
   */
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
