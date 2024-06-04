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
import { endOfMonth, startOfMonth } from 'date-fns';
import { User } from 'src/users/entities/user.entity';
import { CommonApiParams } from 'src/utils/api-param/common-api-params';
import { DateApiParams } from 'src/utils/api-param/date-api-param';
import { PaginationApiParams } from 'src/utils/api-param/pagination.api-param';
import { CustomLogger } from 'src/utils/custom-logger';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { getPagination } from 'src/utils/get-pagination';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { DateQueryParams } from 'src/utils/query-param/date.query-param';
import { PaginationQueryParams } from 'src/utils/query-param/pagination.query-param';
import { getRequestLog } from 'src/utils/request-utils';
import { Pagination } from 'src/utils/types/pagination.type';
import { BankStatementsService } from './bank-statements.service';
import { BSMePrevDaysTimeIntervalEnum } from './enums/bs-me-prev-days-time-interval.enum';
import { BSMeTimeIntervalEnum } from './enums/bs-me-time-interval.enum';
import { IBSGetMePreviousDaysResponse } from './interfaces/bs-get-me-previous-days-response.interface';
import { IBSGetMeResponse } from './interfaces/bs-get-me-response.interface';

@ApiTags('BankStatements')
@Controller({
  path: 'bank-statements',
  version: '1',
})
export class BankStatementsController {
  private logger = new CustomLogger(BankStatementsController.name, {
    timestamp: true,
  });

  constructor(private readonly bankStatementsService: BankStatementsService) {}

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiQuery(DateApiParams.yearMonth)
  @ApiQuery(DateApiParams.timeInterval)
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getMe(
    @Request() request: IRequest,
    @Query(...DateQueryParams.yearMonth) yearMonth: string,
    @Query(...DateQueryParams.timeInterval)
    timeInterval?: BSMeTimeIntervalEnum | undefined,
    @Query('userId', new ParseNumberPipe({ min: 1, required: false }))
    userId?: number | null,
  ): Promise<IBSGetMeResponse> {
    this.logger.log(getRequestLog(request));
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    
    const yearMonthDate = yearMonth ? new Date(yearMonth) : new Date();
    return this.bankStatementsService.getMe({
      startDate: startOfMonth(yearMonthDate).toISOString(),
      endDate: endOfMonth(yearMonthDate).toISOString(),
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
