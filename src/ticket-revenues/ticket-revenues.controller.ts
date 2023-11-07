import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Request,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DateApiParams } from 'src/utils/api-param/date.api-param';
import { DescriptionApiParam } from 'src/utils/api-param/description-api-param';
import { PaginationApiParams } from 'src/utils/api-param/pagination.api-param';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { DateQueryParams } from 'src/utils/query-param/date.query-param copy';
import { PaginationQueryParams } from 'src/utils/query-param/pagination.query-param';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { ITicketRevenuesGetGrouped } from './interfaces/ticket-revenues-get-grouped.interface';
import { ITicketRevenuesGroupedResponse } from './interfaces/ticket-revenues-grouped-response.interface';
import { TicketRevenuesGroup } from './objs/TicketRevenuesGroup';
import { TicketRevenuesService } from './ticket-revenues.service';

@ApiTags('TicketRevenues')
@Controller({
  path: 'ticket-revenues',
  version: '1',
})
export class TicketRevenuesController {
  constructor(private readonly ticketRevenuesService: TicketRevenuesService) { }

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('/me')
  @HttpCode(HttpStatus.OK)
  @ApiQuery(PaginationApiParams.page)
  @ApiQuery(PaginationApiParams.limit)
  @ApiQuery(DateApiParams.startDate)
  @ApiQuery(DateApiParams.endDate)
  @ApiQuery(DateApiParams.timeInterval)
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: false,
    description: DescriptionApiParam({ default: 'Your logged user id (me)' }),
  })
  async getMe(
    @Request() request,
    @Query(...PaginationQueryParams.page) page: number,
    @Query(...PaginationQueryParams.limit) limit: number,
    @Query('timeInterval') timeInterval: TimeIntervalEnum,
    @Query(...DateQueryParams.endDate) endDate: string,
    @Query(...DateQueryParams.startDate) startDate?: string,
    @Query('userId', new ParseNumberPipe({ min: 0, required: false }))
    userId?: number | null,
  ): Promise<ITicketRevenuesGroupedResponse> {
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const args: ITicketRevenuesGetGrouped = {
      startDate,
      endDate,
      timeInterval,
      userId: isUserIdNumber ? userId : request.user.id,
    };
    const pagination: IPaginationOptions = { limit, page };
    const response = await this.ticketRevenuesService.getMeFromUser(args, pagination);
    return response;
  }

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('/me/grouped')
  @HttpCode(HttpStatus.OK)
  @ApiQuery(DateApiParams.startDate)
  @ApiQuery(DateApiParams.endDate)
  @ApiQuery(DateApiParams.timeInterval)
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: false,
    description: DescriptionApiParam({ default: 'Your logged user id (me)' }),
  })
  async getMeGrouped(
    @Request() request,
    @Query(...DateQueryParams.endDate) endDate: string,
    @Query(...DateQueryParams.startDate) startDate?: string,
    @Query('timeInterval') timeInterval?: TimeIntervalEnum,
    @Query('userId', new ParseNumberPipe({ min: 0, required: false }))
    userId?: number | null,
  ): Promise<TicketRevenuesGroup> {
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const args: ITicketRevenuesGetGrouped = {
      startDate,
      endDate,
      timeInterval,
      userId: isUserIdNumber ? userId : request.user.id,
    };
    return await this.ticketRevenuesService.getMeGroupedFromUser(args);
  }
}
