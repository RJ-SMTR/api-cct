import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { isSameDay, isToday, nextFriday, startOfDay, subDays } from 'date-fns';


import { TicketRevenueDTO } from '../domain/dto/ticket-revenue.dto';
import { TicketRevenuesGroupDto } from '../domain/dto/ticket-revenues-group.dto';
import { ITRGetMeGroupedArgs } from '../domain/interface/tr-get-me-grouped-args.interface';
import { TRGetMeGroupedResponseDto } from '../domain/interface/tr-get-me-grouped-response.interface';
import { ITRGetMeIndividualArgs } from '../domain/interface/tr-get-me-individual-args.interface';
import { ITRGetMeIndividualResponse } from '../domain/interface/tr-get-me-individual-response.interface';
import { TicketRevenuesRepositoryService as TicketRevenuesRepository } from '../repository/ticket-revenues.repository';
import { TicketRevenuesGroups } from '../domain/types/ticket-revenues-groups.type';
import { CustomLogger } from 'src/utils/custom-logger';
import { Ocorrencia } from 'src/domain/entity/ocorrencia.entity';
import { getNthWeek } from 'src/utils/date-utils';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import { logError } from 'src/utils/log-utils';
import { getPaymentDates, PaymentEndpointType, PAYMENT_START_WEEKDAY } from 'src/utils/payment-date-utils';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { UsersService } from './users.service';
import { User } from 'src/domain/entity/user.entity';

export interface IFetchTicketRevenues {
  cpfCnpj?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  getToday?: boolean;
  previousDays?: boolean;
}

@Injectable()
export class TicketRevenuesService {
  private logger = new CustomLogger(TicketRevenuesService.name, { timestamp: true });

  constructor(
    private readonly usersService: UsersService, //
    private readonly ticketRevenuesRepository: TicketRevenuesRepository,
  ) {}

  /**
   * TODO: refactor - use repository method
   *
   * Service method
   */
  public async getMeGrouped(args: ITRGetMeGroupedArgs): Promise<TicketRevenuesGroupDto> {
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
    const ticketRevenuesResponse: TicketRevenueDTO[] = await this.findManyIndividual({
      cpfCnpj: [user.getCpfCnpj()],
      startDate,
      endDate,
    });

    if (ticketRevenuesResponse.length === 0) {
      return new TicketRevenuesGroupDto();
    }
    const ticketRevenuesGroupSum = this.getGroupSum(ticketRevenuesResponse);

    return ticketRevenuesGroupSum;
  }

  private async validateGetMeGrouped(args: ITRGetMeGroupedArgs): Promise<User> {
    const user = await this.usersService.getOne({ id: args?.userId });
    return user;
  }

  public async getMe(args: ITRGetMeGroupedArgs, pagination: PaginationOptions, endpoint: PaymentEndpointType): Promise<TRGetMeGroupedResponseDto> {
    const METHOD = 'getMe';
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
    let ticketRevenuesResponse: TicketRevenueDTO[] = await this.findManyIndividual({
      cpfCnpj: [user.getCpfCnpj()],
      startDate,
      endDate,
    });

    const paidSum = ticketRevenuesResponse.reduce((s, i) => s + i.paidValue, 0);

    if (ticketRevenuesResponse.length === 0) {
      return new TRGetMeGroupedResponseDto({
        startDate: null,
        endDate: null,
        amountSum: 0,
        paidSum,
        todaySum: 0,
        count: 0,
        ticketCount: 0,
        data: this.fillDatesInGroups([], groupBy, startDate, endDate),
      });
    }

    let ticketRevenuesGroups = this.getTicketRevenuesGroups(ticketRevenuesResponse, groupBy);

    ticketRevenuesGroups = this.fillDatesInGroups(ticketRevenuesGroups, groupBy, startDate, endDate);

    if (pagination) {
      const offset = pagination?.limit * (pagination?.page - 1);
      ticketRevenuesGroups = ticketRevenuesGroups.slice(offset, offset + pagination.limit);
    }

    const transactionValueLastDay = Number(
      ticketRevenuesResponse
        .filter((i) => isToday(new Date(i.processingDateTime)))
        .reduce((sum, i) => sum + (i?.transactionValue || 0), 0)
        .toFixed(2),
    );

    ticketRevenuesResponse = this.ticketRevenuesRepository.removeTodayData(ticketRevenuesResponse, endDate);
    ticketRevenuesGroups = this.ticketRevenuesRepository.removeTodayData(ticketRevenuesGroups, endDate);

    const amountSum = TicketRevenuesGroupDto.getAmountSum(ticketRevenuesGroups);

    const ticketCount = ticketRevenuesGroups.reduce((sum, i) => sum + i.count, 0);

    return new TRGetMeGroupedResponseDto({
      startDate: ticketRevenuesResponse[ticketRevenuesResponse.length - 1]?.processingDateTime || null,
      endDate: ticketRevenuesResponse[0]?.processingDateTime || null,
      amountSum,
      paidSum,
      todaySum: transactionValueLastDay,
      count: ticketRevenuesGroups.length,
      ticketCount,
      data: ticketRevenuesGroups,
    });
  }

  fillDatesInGroups(groups: TicketRevenuesGroupDto[], groupBy: 'day' | 'week' | 'month' | 'all' | string, startDate: Date, endDate: Date) {
    const newGroups: TicketRevenuesGroupDto[] = [];
    if (groupBy === 'day') {
      /**
       * Para cada dia, do dataFim ao dataInicio,
       * adiciona item existente ou adiciona vazio
       */
      for (let day = endDate; day >= startDate; day = subDays(day, 1)) {
        const existing = groups.filter((i) => isSameDay(new Date(i.date), day))[0] as TicketRevenuesGroupDto | undefined;
        if (existing) {
          newGroups.push(existing);
        } else {
          newGroups.push(
            new TicketRevenuesGroupDto({
              date: startOfDay(day).toISOString(),
            }),
          );
        }
      }
    }
    return newGroups;
  }

  public async findManyIndividual(args: IFetchTicketRevenues): Promise<TicketRevenueDTO[]> {
    const today = new Date();
    const revenues = await this.ticketRevenuesRepository.findManyIndividual({
      where: {
        transacaoView: {
          datetimeProcessamento: {
            between: [
              [args?.startDate || new Date(0), args?.endDate || new Date()], //
              ...(args.getToday ? [[today, today] as [Date, Date]] : []),
            ],
          },
          ...(args?.cpfCnpj?.length ? { operadoraCpfCnpj: args.cpfCnpj } : {}),
          isPreviousDays: args.previousDays,
        },
      },
      order: {
        datetimeProcessamento: 'DESC',
      },
      ...(args?.offset ? { skip: args.offset } : {}),
      ...(args?.limit ? { take: args.limit } : {}),
    });
    return revenues;
  }

  private async validateGetMe(args: ITRGetMeGroupedArgs): Promise<User> {
    const user = await this.usersService.getOne({ id: args?.userId });
    return user;
  }

  private getGroupSum(data: TicketRevenueDTO[]): TicketRevenuesGroupDto {
    const METHOD = this.getGroupSum.name;
    const groupSums = this.getTicketRevenuesGroups(data, 'all');
    if (groupSums.length >= 1) {
      if (groupSums.length > 1) {
        logError(this.logger, 'ticketRevenuesGroupSum should have 0-1 items, getting first one.', METHOD);
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
  private getTicketRevenuesGroups(ticketRevenues: TicketRevenueDTO[], groupBy: 'day' | 'week' | 'month' | 'all' | string): TicketRevenuesGroupDto[] {
    const result = ticketRevenues.reduce((group: TicketRevenuesGroups, revenue: TicketRevenueDTO) => {
      const startWeekday: WeekdayEnum = PAYMENT_START_WEEKDAY;
      const itemDate = new Date(revenue.processingDateTime);
      const nthWeek = getNthWeek(itemDate, startWeekday);
      const errors = Ocorrencia.getErrors(revenue.ocorrencias);

      // 'day', default,
      let dateGroup = revenue.processingDateTime.slice(0, 10);
      if (groupBy === 'week') {
        dateGroup = String(nthWeek);
      }
      if (groupBy === 'month') {
        dateGroup = itemDate.toISOString().slice(0, 7);
      }
      if (groupBy === 'all') {
        dateGroup = 'all';
      }

      if (!group[dateGroup]) {
        const friday = nextFriday(new Date(revenue.processingDateTime)).toISOString();
        const day = revenue.processingDateTime;
        const procsesingDate = groupBy === 'week' ? friday : day;
        const newGroup = new TicketRevenuesGroupDto({
          count: 0,
          date: procsesingDate,
          transportTypeCounts: {},
          directionIdCounts: {},
          paymentMediaTypeCounts: {},
          transactionTypeCounts: {},
          transportIntegrationTypeCounts: {},
          stopIdCounts: {},
          stopLatCounts: {},
          stopLonCounts: {},
          transactionValueSum: 0,
          paidValueSum: 0,
          aux_epochWeek: nthWeek,
          aux_nthWeeks: [],
          aux_groupDateTime: itemDate.toISOString(),
          isPago: true,
          errors: [],
        });
        group[dateGroup] = newGroup;
      }
      group[dateGroup].appendItem(revenue);
      return group;
    }, {});
    const resultList = Object.keys(result).map((dateGroup) => result[dateGroup]);
    return resultList;
  }

  public async getMeIndividual(args: ITRGetMeIndividualArgs, paginationOptions: PaginationOptions): Promise<Pagination<ITRGetMeIndividualResponse>> {
    const validArgs = await this.validateGetMeIndividual(args);
    return await this.ticketRevenuesRepository.getMeIndividual(validArgs, paginationOptions);
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
