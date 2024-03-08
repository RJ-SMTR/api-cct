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
import { DateApiParams } from 'src/utils/api-param/date-api-param';
import { DescriptionApiParam } from 'src/utils/api-param/description-api-param';
import { PaginationApiParams } from 'src/utils/api-param/pagination.api-param';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { DateQueryParams } from 'src/utils/query-param/date.query-param';
import { PaginationQueryParams } from 'src/utils/query-param/pagination.query-param';
import { Pagination } from 'src/utils/types/pagination.type';
import { TRTimeIntervalEnum } from './enums/tr-time-interval.enum';
import { ITicketRevenuesGroup } from './interfaces/ticket-revenues-group.interface';
import { ITRGetMeGroupedResponse } from './interfaces/tr-get-me-grouped-response.interface';
import { ITRGetMeIndividualResponse } from './interfaces/tr-get-me-individual-response.interface';
import { TicketRevenuesService } from './ticket-revenues.service';

@ApiTags('TicketRevenues')
@Controller({
  path: 'ticket-revenues',
  version: '1',
})
export class TicketRevenuesController {
  constructor(private readonly ticketRevenuesService: TicketRevenuesService) {}

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
    @Query(...DateQueryParams.endDate) endDate?: string,
    @Query(...DateQueryParams.startDate) startDate?: string,
    @Query('userId', new ParseNumberPipe({ min: 1, required: false }))
    userId?: number | null,
  ): Promise<ITRGetMeGroupedResponse> {
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    return await this.ticketRevenuesService.getMe(
      {
        startDate,
        endDate,
        timeInterval,
        userId: isUserIdNumber ? userId : request.user.id,
      },
      { limit, page },
      'ticket-revenues',
    );
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
    @Query('userId', new ParseNumberPipe({ min: 1, required: false }))
    userId?: number | null,
  ): Promise<ITicketRevenuesGroup> {
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    return await this.ticketRevenuesService.getMeGrouped({
      startDate,
      endDate,
      timeInterval,
      userId: isUserIdNumber ? userId : request.user.id,
    });
  }

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('/me/individual')
  @HttpCode(HttpStatus.OK)
  @ApiQuery(PaginationApiParams.page)
  @ApiQuery(PaginationApiParams.limit)
  @ApiQuery(DateApiParams.startDate)
  @ApiQuery(DateApiParams.endDate)
  @ApiQuery(
    DateApiParams.getTimeInterval(
      TRTimeIntervalEnum,
      TRTimeIntervalEnum.LAST_WEEK,
    ),
  )
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: false,
    description: DescriptionApiParam({ default: 'Your logged user id (me)' }),
  })
  async getMeIndividual(
    @Request() request,
    @Query(...PaginationQueryParams.page) page: number,
    @Query(...PaginationQueryParams.limit) limit: number,
    @Query(...DateQueryParams.endDate) endDate: string,
    @Query(...DateQueryParams.startDate) startDate?: string,
    @Query('timeInterval') timeInterval?: TRTimeIntervalEnum,
    @Query('userId', new ParseNumberPipe({ min: 1, required: false }))
    userId?: number | null,
  ): Promise<Pagination<ITRGetMeIndividualResponse>> {
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    return await this.ticketRevenuesService.getMeIndividual(
      {
        startDate,
        endDate,
        timeInterval,
        userId: isUserIdNumber ? userId : request.user.id,
      },
      { limit, page },
    );
  }
}
