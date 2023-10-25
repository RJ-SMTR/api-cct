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
import { UsersService } from 'src/users/users.service';
import { TicketRevenuesService } from './ticket-revenues.service';
import { PaginationApiParams } from 'src/utils/api-param/pagination.api-param';
import { DateApiParams } from 'src/utils/api-param/date.api-param';
import { ITicketRevenuesGroupedResponse } from './interfaces/ticket-revenues-grouped-response.interface';
import { ITicketRevenuesGetGrouped } from './interfaces/ticket-revenues-get-grouped.interface';
import { PaginationQueryParams } from 'src/utils/query-param/pagination.query-param';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { DateQueryParams } from 'src/utils/query-param/date.query-param copy';

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
  @Get('/me/grouped')
  @HttpCode(HttpStatus.OK)
  @ApiQuery(PaginationApiParams.page)
  @ApiQuery(PaginationApiParams.limit)
  @ApiQuery(DateApiParams.startDate)
  @ApiQuery(DateApiParams.endDate)
  @ApiQuery(DateApiParams.timeInterval)
  async getGrouped(
    @Request() request,
    @Query(...PaginationQueryParams.page) page: number,
    @Query(...PaginationQueryParams.limit) limit: number,
    @Query(...DateQueryParams.startDate) startDate?: string,
    @Query(...DateQueryParams.endDate) endDate?: string,
    @Query(...DateQueryParams.timeInterval)
    timeInterval?: TimeIntervalEnum | undefined,
  ): Promise<ITicketRevenuesGroupedResponse> {
    const user = await this.usersService.getOneFromRequest(request);
    const args: ITicketRevenuesGetGrouped = {
      startDate,
      endDate,
      timeInterval,
    };
    const pagination: IPaginationOptions = { limit, page };
    return await this.ticketRevenuesService.getGroupedFromUser(
      user,
      args,
      pagination,
    );
  }
}
