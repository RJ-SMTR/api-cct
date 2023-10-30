import {
  Controller,
  HttpCode,
  HttpStatus,
  Get,
  Request,
  SerializeOptions,
  UseGuards,
  Query,
} from '@nestjs/common';
import { BankStatementsService } from './bank-statements.service';
import { UsersService } from 'src/users/users.service';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DateApiParams } from 'src/utils/api-param/date.api-param';
import { DateQueryParams } from 'src/utils/query-param/date.query-param copy';
import { IBankStatementsResponse } from './interfaces/bank-statements-response.interface';
import { IBankStatementsGet } from './interfaces/bank-statements-get.interface';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';

@ApiTags('BankStatements')
@Controller({
  path: 'bank-statements',
  version: '1',
})
export class BankStatementsController {
  constructor(
    private readonly bankStatementsService: BankStatementsService,
    private readonly usersService: UsersService,
  ) {}

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiQuery(DateApiParams.startDate)
  @ApiQuery(DateApiParams.endDate)
  @ApiQuery(DateApiParams.timeInterval)
  @HttpCode(HttpStatus.OK)
  async getBankStatementsFromUser(
    @Request() request,
    @Query(...DateQueryParams.startDate) startDate?: string,
    @Query(...DateQueryParams.endDate) endDate?: string,
    @Query(...DateQueryParams.timeInterval)
    timeInterval?: TimeIntervalEnum | undefined,
  ): Promise<IBankStatementsResponse> {
    const user = await this.usersService.getOneFromRequest(request);
    const args: IBankStatementsGet = { startDate, endDate, timeInterval };
    return this.bankStatementsService.getBankStatementsFromUser(user, args);
  }
}
