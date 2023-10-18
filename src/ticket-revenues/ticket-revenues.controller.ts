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
import { IJaeTicketRevenue } from 'src/jae/interfaces/jae-ticket-revenue.interface';
import { MinMaxNumberPipe } from 'src/utils/pipes/min-max-number.pipe';
import { InfinityPaginationResultType } from 'src/utils/types/infinity-pagination-result.type';
import { infinityPagination } from 'src/utils/infinity-pagination';
import { IJaeTicketRevenueGroup } from 'src/jae/interfaces/jae-ticket-revenue-group.interface';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import { TicketRevenuesGroupByEnum } from './enums/ticket-revenues-group-by.enum';
import { ValidateEnumPipe } from 'src/utils/pipes/validate-enum.pipe';

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
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'default: 1 (min)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'default: 500 (max)',
  })
  @ApiQuery({
    name: 'ignorePreviousWeek',
    type: Boolean,
    required: false,
    description: 'default: true',
  })
  @ApiQuery({
    name: 'startWeekday',
    required: false,
    description:
      'possibleValues: 0 (monday) - 6 (sunday), default: 3 (thursday)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'hours: 00:00',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'hours: 23:59:59.999',
  })
  @ApiQuery({
    name: 'previousDays',
    required: false,
    description: 'default: 30, minimum: 0',
  })
  async getUngrouped(
    @Request() request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(500), ParseIntPipe) limit: number,
    /**
     * @type `boolean` in compile time
     * @bug Type is set as `boolean | any` because if type is boolean the DefaultValuePipe will be always `false`.
     */
    @Query('ignorePreviousWeek', new DefaultValuePipe(true), ParseBoolPipe)
    ignorePreviousWeek: boolean | any,
    @Query(
      'startWeekday',
      new DefaultValuePipe(WeekdayEnum.THURSDAY),
      new MinMaxNumberPipe({ min: 0, max: 6 }),
      ParseIntPipe,
    )
    startWeekday: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('previousDays', new MinMaxNumberPipe({ min: 0 }))
    previousDays?: number | undefined,
  ): Promise<InfinityPaginationResultType<IJaeTicketRevenue>> {
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
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'default: 1 (min)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'default: 500 (max)',
  })
  @ApiQuery({
    name: 'ignorePreviousWeek',
    type: Boolean,
    required: false,
    description: 'default: true',
  })
  @ApiQuery({
    name: 'startWeekday',
    required: false,
    description:
      'possibleValues: 0 (monday) - 6 (sunday), default: 3 (thursday)',
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    description:
      `possibleValues: [${Object.values(TicketRevenuesGroupByEnum)}], ` +
      `default: ${TicketRevenuesGroupByEnum.DAY}`,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'hours: 00:00',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'hours: 23:59:59.999',
  })
  @ApiQuery({
    name: 'previousDays',
    required: false,
    description: `default: 30, minimum: 0`,
  })
  async getGrouped(
    @Request() request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(500), ParseIntPipe) limit: number,
    /**
     * @type `boolean` in compile time
     * @bug Type is set as `boolean | any` because if type is boolean the DefaultValuePipe will be always `false`.
     */
    @Query('ignorePreviousWeek', new DefaultValuePipe(true), ParseBoolPipe)
    ignorePreviousWeek: boolean | any,
    @Query(
      'startWeekday',
      new DefaultValuePipe(WeekdayEnum.THURSDAY),
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
  ): Promise<InfinityPaginationResultType<IJaeTicketRevenueGroup>> {
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
