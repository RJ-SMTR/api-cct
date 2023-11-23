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
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { DateQueryParams } from 'src/utils/query-param/date.query-param';
import { BankStatementsService } from './bank-statements.service';
import { IBankStatementsGet } from './interfaces/bank-statements-get.interface';
import { IBankStatementsResponse } from './interfaces/bank-statements-response.interface';

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
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: DescriptionApiParam({ hours: '23:59:59.999' }),
  })
  @ApiQuery(DateApiParams.timeInterval)
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: false,
    description: DescriptionApiParam({ default: 'Your logged user id (me)' }),
  })
  @HttpCode(HttpStatus.OK)
  async getBankStatementsFromUser(
    @Request() request,
    @Query(...DateQueryParams.startDate) startDate?: string,
    @Query(...DateQueryParams.endDate) endDate?: string,
    @Query(...DateQueryParams.timeInterval)
    timeInterval?: TimeIntervalEnum | undefined,
    @Query('userId', new ParseNumberPipe({ min: 0, required: false }))
    userId?: number | null,
  ): Promise<IBankStatementsResponse> {
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const args: IBankStatementsGet = {
      startDate,
      endDate,
      timeInterval,
      userId: isUserIdNumber ? userId : request.user.id,
    };
    return this.bankStatementsService.getBankStatementsFromUser(
      args,
      'bank-statements',
    );
  }
}
