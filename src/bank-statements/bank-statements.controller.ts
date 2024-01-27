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
import {
  BSMeTimeIntervalEnum,
  BSTimeIntervalEnum,
} from 'src/utils/enums/time-interval.enum';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { DateQueryParams } from 'src/utils/query-param/date.query-param';
import { BankStatementsService } from './bank-statements.service';
import { IBSGetMeDayResponse } from './interfaces/bs-get-me-day-response.interface';
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
    @Query('userId', new ParseNumberPipe({ min: 0, required: false }))
    userId?: number | null,
  ): Promise<IBSGetMeResponse> {
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    return this.bankStatementsService.getMe({
      startDate,
      endDate,
      timeInterval: timeInterval
        ? (timeInterval as unknown as BSTimeIntervalEnum)
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
    @Query('userId', new ParseNumberPipe({ min: 0, required: false }))
    userId?: number | null,
  ): Promise<IBSGetMeDayResponse> {
    const isUserIdParam = userId !== null && !isNaN(Number(userId));
    return this.bankStatementsService.getMeDay({
      endDate: date,
      userId: isUserIdParam ? userId : (request.user as User).id,
    });
  }
}
