import { Controller, Get, HttpCode, HttpStatus, Query, Request, SerializeOptions, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { endOfMonth, isFriday, nextFriday, previousFriday, startOfMonth, subDays } from 'date-fns';
import { DateApiParams } from 'src/utils/api-param/date-api-param';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { PaginationApiParams } from 'src/utils/api-param/pagination.api-param';
import { CustomLogger } from 'src/utils/custom-logger';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { DateQueryParams } from 'src/utils/query-param/date.query-param';
import { PaginationQueryParams } from 'src/utils/query-param/pagination.query-param';
import { getRequestLog } from 'src/utils/request-utils';
import { Pagination } from 'src/utils/types/pagination.type';
import { TicketRevenuesGroupDto } from './dtos/ticket-revenues-group.dto';
import { TRTimeIntervalEnum } from './enums/tr-time-interval.enum';
import { TRGetMeGroupedResponseDto } from './interfaces/tr-get-me-grouped-response.interface';
import { ITRGetMeIndividualResponse } from './interfaces/tr-get-me-individual-response.interface';
import { TicketRevenuesService } from './ticket-revenues.service';
import { ParseYearMonthPipe } from 'src/utils/pipes/parse-year-month.pipe';

@ApiTags('TicketRevenues')
@Controller({
  path: 'ticket-revenues',
  version: '1',
})
export class TicketRevenuesController {
  private logger = new CustomLogger(TicketRevenuesController.name, {
    timestamp: true,
  });

  constructor(private readonly ticketRevenuesService: TicketRevenuesService) {}

  /**
   * Dado semanal
   *
   * @param endDate sexta de pagamento
   *
   * Dado diário
   *
   * @param startDate dia selecionado
   * @param endDate dia selecionado
   *
   * Não utilizado
   * @param timeInterval
   *
   * Retorno:
   *
   * - status:
   *  - _Nulo_: Se não tiver valor
   *  - Pago: Se tiver valor e for tudo pago
   *  - A pagar: Se tiver valor e tiver algum item não pago
   *  - Pendente: Quando tiver erros
   */
  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('/me')
  @HttpCode(HttpStatus.OK)
  @ApiQuery(PaginationApiParams.page)
  @ApiQuery(PaginationApiParams.limit)
  @ApiQuery({ name: 'startDate', required: false, description: ApiDescription({ hours: '00:00' }) })
  @ApiQuery({ name: 'endDate', required: false, description: ApiDescription({ hours: '23:59:59.999' }) })
  @ApiQuery({ name: 'timeInterval', required: false, description: ApiDescription({ default: TimeIntervalEnum.LAST_MONTH }), example: TimeIntervalEnum.LAST_MONTH, enum: TimeIntervalEnum })
  @ApiQuery({ name: 'userId', type: Number, required: false, description: ApiDescription({ default: 'Your logged user id (me)' }) })
  async getMe(
    @Request() request,
    @Query(...PaginationQueryParams.page) page: number,
    @Query(...PaginationQueryParams.limit) limit: number,
    @Query('timeInterval') timeInterval: TimeIntervalEnum,
    @Query('endDate', new ParseDatePipe({ optional: true })) endDate: string | undefined,
    @Query('startDate', new ParseDatePipe({ optional: true })) startDate: string | undefined,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: false }))
    userId?: number | null,
  ): Promise<TRGetMeGroupedResponseDto> {
    this.logger.log(getRequestLog(request));
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
  @ApiQuery({ name: 'startDate', required: false, description: ApiDescription({ hours: '00:00' }) })
  @ApiQuery({ name: 'endDate', required: false, description: ApiDescription({ hours: '23:59:59.999' }) })
  @ApiQuery({ name: 'yearMonth', required: false, example: '2024-01' })
  @ApiQuery({ name: 'timeInterval', required: false, description: ApiDescription({ default: TimeIntervalEnum.LAST_MONTH }) })
  @ApiQuery({ name: 'userId', type: Number, required: false, description: ApiDescription({ default: 'Your logged user id (me)' }) })
  async getMeGrouped(
    @Request() request,
    @Query('startDate', new ParseDatePipe({ optional: true })) startDate: string | undefined,
    @Query('endDate', new ParseDatePipe({ optional: true })) endDate: string | undefined,
    @Query('yearMonth', new ParseYearMonthPipe(true)) yearMonth?: string | undefined,
    @Query('timeInterval') timeInterval?: TimeIntervalEnum,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: false }))
    userId?: number | null,
  ): Promise<TicketRevenuesGroupDto> {
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    if (yearMonth) {
      const month = new Date(yearMonth + '-01');
      let _startDate = startOfMonth(month);
      let _endDate = endOfMonth(month);
      if (!isFriday(_startDate)) {
        _startDate = nextFriday(_startDate);
      }
      _startDate = subDays(_startDate, 8);
      if (!isFriday(_endDate)) {
        _endDate = previousFriday(_endDate);
      }
      _endDate = subDays(_endDate, 2);
      return await this.ticketRevenuesService.getMeGrouped({
        startDate: _startDate.toISOString().slice(0, 10),
        endDate: _endDate.toISOString().slice(0, 10),
        timeInterval,
        userId: isUserIdNumber ? userId : request.user.id,
      });
    }
    return await this.ticketRevenuesService.getMeGrouped({
      startDate,
      endDate,
      timeInterval,
      userId: isUserIdNumber ? userId : request.user.id,
    });
  }

  @Get('/me/individual')
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ groups: ['me'] })
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiQuery(PaginationApiParams.page)
  @ApiQuery(PaginationApiParams.limit)
  @ApiQuery({ name: 'startDate', required: false, description: ApiDescription({ hours: '00:00' }) })
  @ApiQuery({ name: 'endDate', required: false, description: ApiDescription({ hours: '23:59:59.999' }) })
  @ApiQuery(DateApiParams.getTimeInterval(TRTimeIntervalEnum, TRTimeIntervalEnum.LAST_WEEK))
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: false,
    description: ApiDescription({ default: 'Your logged userId (me)' }),
  })
  async getMeIndividual(
    @Request() request,
    @Query(...PaginationQueryParams.page) page: number,
    @Query(...PaginationQueryParams.limit) limit: number,
    @Query('startDate', new ParseDatePipe({ optional: true })) startDate: string | undefined,
    @Query('endDate', new ParseDatePipe({ optional: true })) endDate: string | undefined,
    @Query('timeInterval') timeInterval?: TRTimeIntervalEnum,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: false }))
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
