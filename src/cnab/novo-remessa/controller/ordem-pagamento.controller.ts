import { Controller, Get, HttpCode, HttpStatus, Query, Request, SerializeOptions, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CommonApiParams } from 'src/utils/api-param/common-api-params';
import { DateApiParams } from 'src/utils/api-param/date-api-param';
import { CustomLogger } from 'src/utils/custom-logger';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { DateQueryParams } from 'src/utils/query-param/date.query-param';
import { getRequestLog } from 'src/utils/request-utils';
import { OrdemPagamentoService } from '../service/ordem-pagamento.service';
import { OrdemPagamentoAgrupadoMensalDto } from '../dto/ordem-pagamento-agrupado-mensal.dto';

@ApiTags('OrdemPagamento')
@Controller({
  path: 'ordem-pagamento',
  version: '1',
})
export class OrdemPagamentoController {
  private logger = new CustomLogger(OrdemPagamentoController.name, {
    timestamp: true,
  });

  constructor(private readonly ordemPagamentoService: OrdemPagamentoService) {}

  @Get('mensal')
  @UseGuards(AuthGuard('jwt'))
  @SerializeOptions({ groups: ['me'] })
  @ApiBearerAuth()
  @ApiQuery(DateApiParams.yearMonth)
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async get(
    @Request() request: IRequest, //
    @Query(...DateQueryParams.yearMonth) yearMonth: string,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: true })) userId?: number | null,
  ): Promise<OrdemPagamentoAgrupadoMensalDto[]> {
    this.logger.log(getRequestLog(request));
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const yearMonthDate = yearMonth ? new Date(yearMonth): new Date();
    return this.ordemPagamentoService.findOrdensPagamentoAgrupadasPorMes(isUserIdNumber ? Number(userId) : request.user.id, yearMonthDate);
  }

}
