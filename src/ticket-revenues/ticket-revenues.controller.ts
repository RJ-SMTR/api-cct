import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
  ParseIntPipe,
  Query,
  Request,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UsersService } from 'src/users/users.service';
import { TicketRevenuesService } from './ticket-revenues.service';
import { MinMaxNumberPipe } from 'src/utils/pipes/min-max-number.pipe';
import { InfinityPaginationResultType } from 'src/utils/types/infinity-pagination-result.type';
import { infinityPagination } from 'src/utils/infinity-pagination';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import { TicketRevenuesGroupByEnum } from './enums/ticket-revenues-group-by.enum';
import { ValidateEnumPipe } from 'src/utils/pipes/validate-enum.pipe';
import { ITicketRevenue } from './interfaces/ticket-revenue.interface';
import { ITicketRevenuesGroup } from './interfaces/ticket-revenues-group.interface';
import { PaginationApiParams } from 'src/utils/api-param/pagination.api-param';
import { DateApiParams } from 'src/utils/api-param/date.api-param';

@ApiTags('TicketRevenues')
@Controller({
  path: 'ticket-revenues',
  version: '1',
})
export class TicketRevenuesController {
  constructor(
    private readonly ticketRevenuesService: TicketRevenuesService,
    private readonly usersService: UsersService,
  ) {}

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me/ungrouped')
  @HttpCode(HttpStatus.OK)
  @ApiQuery(PaginationApiParams.page)
  @ApiQuery(PaginationApiParams.limit)
  @ApiQuery(DateApiParams.startDate)
  @ApiQuery(DateApiParams.endDate)
  @ApiQuery(DateApiParams.previousDays)
  @ApiQuery(DateApiParams.ignorePreviousWeek)
  @ApiQuery(DateApiParams.startWeekday(WeekdayEnum._3_THURSDAY))
  async getUngrouped(
    @Request() request,
    @Query('page', new DefaultValuePipe(1), new MinMaxNumberPipe({ min: 1 }))
    page: number,
    @Query(
      'limit',
      new DefaultValuePipe(500),
      new MinMaxNumberPipe({ max: 500 }),
    )
    limit: number,
    /**
     * @type `boolean` in compile time
     * @bug Type is set as `boolean | any` because if type is boolean the DefaultValuePipe will be always `false`.
     */
    @Query('ignorePreviousWeek', new DefaultValuePipe(true), ParseBoolPipe)
    ignorePreviousWeek: boolean | any,
    @Query(
      'startWeekday',
      new DefaultValuePipe(WeekdayEnum._3_THURSDAY),
      new MinMaxNumberPipe({ min: 0, max: 6 }),
      ParseIntPipe,
    )
    startWeekday: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('previousDays', new MinMaxNumberPipe({ min: 0 }))
    previousDays?: number | undefined,
  ): Promise<InfinityPaginationResultType<ITicketRevenue>> {
    const user = await this.usersService.getOneFromRequest(request);
    return infinityPagination(
      await this.ticketRevenuesService.getUngroupedFromUser(
        user,
        { startDate, endDate, previousDays, startWeekday, ignorePreviousWeek },
        { limit, page },
      ),
      { limit, page },
    );
  }

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('/me/grouped')
  @HttpCode(HttpStatus.OK)
  @ApiQuery(PaginationApiParams.page)
  @ApiQuery(PaginationApiParams.limit)
  @ApiQuery(DateApiParams.startDate)
  @ApiQuery(DateApiParams.endDate)
  @ApiQuery(DateApiParams.previousDays)
  @ApiQuery(DateApiParams.ignorePreviousWeek)
  @ApiQuery(DateApiParams.startWeekday(WeekdayEnum._3_THURSDAY))
  @ApiQuery({
    name: 'groupBy',
    required: false,
    description:
      `**allowedValues:** \`${Object.values(TicketRevenuesGroupByEnum).join(
        '`, `',
      )}\`, ` + `**default:** \`${TicketRevenuesGroupByEnum.DAY}\``,
  })
  async getGrouped(
    @Request() request,
    @Query('page', new DefaultValuePipe(1), new MinMaxNumberPipe({ min: 1 }))
    page: number,
    @Query(
      'limit',
      new DefaultValuePipe(500),
      new MinMaxNumberPipe({ max: 500 }),
    )
    limit: number,
    /**
     * **Bug:** Type is set as `boolean | any` because if type is boolean
     * the DefaultValuePipe will be always `false`.
     *
     * @type `boolean` in compile time
     */
    @Query('ignorePreviousWeek', new DefaultValuePipe(true), ParseBoolPipe)
    ignorePreviousWeek: boolean | any,
    @Query(
      'startWeekday',
      new DefaultValuePipe(WeekdayEnum._3_THURSDAY),
      new MinMaxNumberPipe({ min: 0, max: 6 }),
      ParseIntPipe,
    )
    startWeekday: number,
    @Query(
      'groupBy',
      new DefaultValuePipe(TicketRevenuesGroupByEnum.DAY),
      new ValidateEnumPipe(TicketRevenuesGroupByEnum),
    )
    groupBy: TicketRevenuesGroupByEnum,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('previousDays', new MinMaxNumberPipe({ min: 0 }))
    previousDays?: number | undefined,
  ): Promise<InfinityPaginationResultType<ITicketRevenuesGroup>> {
    const user = await this.usersService.getOneFromRequest(request);
    return infinityPagination(
      await this.ticketRevenuesService.getGroupedFromUser(
        user,
        {
          startDate,
          endDate,
          previousDays,
          ignorePreviousWeek,
          startWeekday,
          groupBy,
        },
        { limit, page },
      ),
      { limit, page },
    );
  }
}
