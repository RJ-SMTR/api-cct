import { Controller, Get, HttpCode, HttpStatus, Query, Request, SerializeOptions, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { User } from 'src/users/entities/user.entity';
import { CommonApiParams } from 'src/utils/api-param/common-api-params';
import { DateApiParams } from 'src/utils/api-param/date-api-param';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { PaginationApiParams } from 'src/utils/api-param/pagination.api-param';
import { CustomLogger } from 'src/utils/custom-logger';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { getPagination } from 'src/utils/get-pagination';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { nextFridayPay } from 'src/utils/payment-date-utils';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseEnumPipe } from 'src/utils/pipes/parse-enum.pipe';
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

  /**
   * Escopo:
   * - Ler TransacaoView e agrupar por cada semana (qui-qua)
   * - Para o mês selecionado pega todas as sextas do mês
   * - Para cada sexta mostrará a soma dos valores de qui-qua
   *    Incluindo dias anteriores se a dataProcessamento estiver naquela semana.
   *
   * Na linha de cada transacao bancária:
   * - "ValorTransacao" soma tudo, mesmo os status pago
   * - "ValorPago" soma apenas os status pago
   *
   * Nos cards do front:
   * - SomaValorPago
   *
   * @param timeInterval Apenas mensal
   */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @SerializeOptions({ groups: ['me'] })
  @ApiBearerAuth()
  @ApiQuery(DateApiParams.yearMonth)
  @ApiQuery(DateApiParams.timeInterval)
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getMe(
    @Request() request: IRequest, //
    @Query(...DateQueryParams.yearMonth) yearMonth: string,
    @Query('timeInterval', new ParseEnumPipe(BSMeTimeIntervalEnum, { optional: true, defaultValue: BSMeTimeIntervalEnum.LAST_MONTH })) timeInterval: BSMeTimeIntervalEnum | undefined,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: true })) userId?: number | null,
  ): Promise<IBSGetMeResponse> {
    this.logger.log(getRequestLog(request));

    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const _timeInterval = timeInterval ? (timeInterval as unknown as TimeIntervalEnum) : undefined;
    const yearMonthDate = yearMonth ? new Date(yearMonth) : _timeInterval === TimeIntervalEnum.LAST_MONTH ? nextFridayPay(new Date(), 'dataProcTransacao') : new Date();

    return this.bankStatementsService.getMe({
      yearMonth: yearMonthDate,
      timeInterval: _timeInterval,
      userId: isUserIdNumber ? userId : request.user.id,
    });
  }

  /**
   * Requisito: {@link https://github.com/RJ-SMTR/api-cct/issues/237 Github #237 }
   *
   * Escopo:
   * - Uma transação é dia anteior quando dataTransacao < dataProcessamento (dia)
   * - O endpoint retorna todas transações de dias anteriores
   *
   * Nas linhas da tabela do front:
   * - dataOrdemPagamento = quinta
   * - dataPagamentoEfetivo = sexta (pega do banco)
   * - Status = A pagar se tiver erro ou isPago = false
   *
   * Para intervalo = semana:
   * - endDate = sexta feira
   * - timeInterval = lastWeek
   *
   * Para intervalo = day:
   * - endDate = data contendo o mês
   * - timeInterval = lastMonth
   *
   * Não é usado:
   * - startDate
   */
  @Get('me/previous-days')
  @UseGuards(AuthGuard('jwt'))
  @SerializeOptions({ groups: ['me'] })
  @ApiBearerAuth()
  @ApiQuery(PaginationApiParams.page)
  @ApiQuery(PaginationApiParams.limit)
  @ApiQuery({ name: 'endDate', required: true, description: ApiDescription({ hours: '23:59:59.999' }) })
  @ApiQuery({ name: 'timeInterval', required: true, example: BSMePrevDaysTimeIntervalEnum.LAST_WEEK, enum: BSMePrevDaysTimeIntervalEnum })
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getMePreviousDays(
    @Request() request: IRequest, //
    @Query(...PaginationQueryParams.page) page: number,
    @Query(...PaginationQueryParams.limit) limit: number,
    @Query('endDate', new ParseDatePipe()) endDate: string,
    @Query('timeInterval', new ParseEnumPipe(BSMePrevDaysTimeIntervalEnum)) timeInterval: BSMePrevDaysTimeIntervalEnum,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: true })) userId?: number | null,
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
