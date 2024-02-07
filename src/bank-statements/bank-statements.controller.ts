import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Request,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { User } from 'src/users/entities/user.entity';
import { CommonApiParams } from 'src/utils/api-param/common-api-params';
import { DateApiParams } from 'src/utils/api-param/date-api-param';
import { PaginationApiParams } from 'src/utils/api-param/pagination.api-param';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { getPagination } from 'src/utils/get-pagination';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { DateQueryParams } from 'src/utils/query-param/date.query-param';
import { PaginationQueryParams } from 'src/utils/query-param/pagination.query-param';
import { Pagination } from 'src/utils/types/pagination.type';
import { BankStatementsService } from './bank-statements.service';
import { BSMePrevDaysTimeIntervalEnum } from './enums/bs-me-prev-days-time-interval.enum';
import { BSMeTimeIntervalEnum } from './enums/bs-me-time-interval.enum';
import { IBSGetMeDayResponse } from './interfaces/bs-get-me-day-response.interface';
import { IBSGetMePreviousDaysResponse } from './interfaces/bs-get-me-previous-days-response.interface';
import { IBSGetMeResponse } from './interfaces/bs-get-me-response.interface';

@ApiTags('BankStatements')
@Controller({
  path: 'bank-statements',
  version: '1',
})
export class BankStatementsController {
  constructor(private readonly bankStatementsService: BankStatementsService) {}

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiQuery(DateApiParams.startDate)
  @ApiQuery(DateApiParams.endDate)
  @ApiQuery(DateApiParams.timeInterval)
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getMe(
    @Request() request,
    @Query(...DateQueryParams.startDate) startDate?: string,
    @Query(...DateQueryParams.endDate) endDate?: string,
    @Query(...DateQueryParams.timeInterval)
    timeInterval?: BSMeTimeIntervalEnum | undefined,
    @Query('userId', new ParseNumberPipe({ min: 1, required: false }))
    userId?: number | null,
  ): Promise<IBSGetMeResponse> {
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    return this.bankStatementsService.getMe({
      startDate,
      endDate,
      timeInterval: timeInterval
        ? (timeInterval as unknown as TimeIntervalEnum)
        : undefined,
      userId: isUserIdNumber ? userId : request.user.id,
    });
  }

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me/day/:date')
  @ApiParam({ name: 'date', example: '2023-01-12' })
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getMeDayDate(
    @Request() request: IRequest,
    @Param('date') date: string,
    @Query('userId', new ParseNumberPipe({ min: 1, required: false }))
    userId?: number | null,
  ): Promise<IBSGetMeDayResponse> {
    const isUserIdParam = userId !== null && !isNaN(Number(userId));
    return this.bankStatementsService.getMeDay({
      endDate: date,
      userId: isUserIdParam ? userId : (request.user as User).id,
    });
  }

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me/previous-days')
  @ApiQuery(PaginationApiParams.page)
  @ApiQuery(PaginationApiParams.limit)
  @ApiQuery(DateApiParams.startDate)
  @ApiQuery(DateApiParams.getEndDate(true))
  @ApiQuery(
    DateApiParams.getTimeInterval(
      BSMePrevDaysTimeIntervalEnum,
      BSMePrevDaysTimeIntervalEnum.LAST_WEEK,
    ),
  )
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getMePreviousDays(
    @Request() request: IRequest,
    @Query(...PaginationQueryParams.page) page: number,
    @Query(...PaginationQueryParams.limit) limit: number,
    @Query(...DateQueryParams.getDate('endDate', true)) endDate: string,
    @Query('timeInterval') timeInterval: BSMePrevDaysTimeIntervalEnum,
    @Query('userId', new ParseNumberPipe({ min: 1, required: false }))
    userId?: number | null,
  ): Promise<Pagination<IBSGetMePreviousDaysResponse>> {
    const isUserIdParam = userId !== null && !isNaN(Number(userId));
    const result = await this.bankStatementsService.getMePreviousDays(
      {
        endDate: endDate,
        timeInterval: timeInterval,
        userId: isUserIdParam ? userId : (request.user as User).id,
      },
      { limit, page },
    );
    return getPagination(
      result,
      {
        dataLenght: result.data.length,
        maxCount: result.data.length,
      },
      { limit, page },
    );
  }
}
