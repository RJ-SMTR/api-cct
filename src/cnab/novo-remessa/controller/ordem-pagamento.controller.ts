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
import { CommonApiParams } from 'src/utils/api-param/common-api-params';
import { DateApiParams } from 'src/utils/api-param/date-api-param';
import { CustomLogger } from 'src/utils/custom-logger';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { DateQueryParams } from 'src/utils/query-param/date.query-param';
import { canProceed, getRequestLog, isAdmin } from 'src/utils/request-utils';
import { OrdemPagamentoService } from '../service/ordem-pagamento.service';
import { OrdemPagamentoSemanalDto } from '../dto/ordem-pagamento-semanal.dto';
import { BigqueryTransacaoService } from '../../../bigquery/services/bigquery-transacao.service';
import { BigqueryTransacao } from '../../../bigquery/entities/transacao.bigquery-entity';
import { OrdemPagamentoMensalDto } from '../dto/ordem-pagamento-mensal.dto';
import { OrdemPagamentoPendenteNuncaRemetidasDto } from '../dto/ordem-pagamento-pendente-nunca-remetidas.dto';
import { UsersService } from '../../../users/users.service';

@ApiTags('OrdemPagamento')
@Controller({
  path: 'ordem-pagamento',
  version: '1',
})
export class OrdemPagamentoController {
  private logger = new CustomLogger(OrdemPagamentoController.name, {
    timestamp: true,
  });

  constructor(private readonly ordemPagamentoService: OrdemPagamentoService,
              private readonly bigqueryTransacaoService: BigqueryTransacaoService,
              private readonly usersService: UsersService) {}

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
  ): Promise<OrdemPagamentoMensalDto> {
    this.logger.log(getRequestLog(request));
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const yearMonthDate = yearMonth ? new Date(yearMonth): new Date();
    const userIdNum = isUserIdNumber ? Number(userId) : request.user.id;
    canProceed(request, Number(userId));
    return this.ordemPagamentoService.findOrdensPagamentoAgrupadasPorMes(userIdNum, yearMonthDate);
  }


  @Get('semanal/:ordemPagamentoAgrupadoId')
  @UseGuards(AuthGuard('jwt'))
  @SerializeOptions({ groups: ['me'] })
  @ApiBearerAuth()
  @ApiParam(CommonApiParams.ordemPagamentoAgrupadoId)
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getSemanal(
    @Request() request: IRequest, //
    @Param('ordemPagamentoAgrupadoId', new ParseNumberPipe({ min: 1, optional: false })) ordemPagamentoAgrupadoId: number,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: false })) userId: number | null,
  ): Promise<OrdemPagamentoSemanalDto[]> {
    this.logger.log(getRequestLog(request));
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const userIdNum = isUserIdNumber ? Number(userId) : request.user.id;
    canProceed(request, Number(userId));
    return this.ordemPagamentoService.findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId, userIdNum);
  }


  @Get('diario/:ordemPagamentoId')
  @UseGuards(AuthGuard('jwt'))
  @SerializeOptions({ groups: ['me'] })
  @ApiBearerAuth()
  @ApiParam(CommonApiParams.ordemPagamentoId)
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getDiario(
    @Request() request: IRequest, //
    @Param('ordemPagamentoId', new ParseNumberPipe({ min: 1, optional: false })) ordemPagamentoId: number,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: false })) userId: number | null,
  ): Promise<BigqueryTransacao[]> {
    this.logger.log(getRequestLog(request));
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const userIdNum = isUserIdNumber ? Number(userId) : request.user.id;
    const user = await this.usersService.findOne({ id: userIdNum})
    canProceed(request, Number(userId));
    return this.bigqueryTransacaoService.findByOrdemPagamentoId(ordemPagamentoId, user?.cpfCnpj, request);
  }


  @Get('transacoes-semana/:ordemPagamentoAgrupadoId')
  @UseGuards(AuthGuard('jwt'))
  @SerializeOptions({ groups: ['me'] })
  @ApiBearerAuth()
  @ApiParam(CommonApiParams.ordemPagamentoAgrupadoId)
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getTransacoesSemana(
    @Request() request: IRequest, //
    @Param('ordemPagamentoAgrupadoId', new ParseNumberPipe({ min: 1, optional: false })) ordemPagamentoAgrupadoId: number,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: false })) userId: number | null,
  ): Promise<BigqueryTransacao[]> {
    this.logger.log(getRequestLog(request));
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const userIdNum = isUserIdNumber ? Number(userId) : request.user.id;
    canProceed(request, Number(userId));

    const ordensPagamento = await this.ordemPagamentoService.findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId, userIdNum);
    const ordemPagamentoIds = ordensPagamento.map((ordem) => ordem.ordemId);

    const user = await this.usersService.findOne({ id: userIdNum})
    return this.bigqueryTransacaoService.findManyByOrdemPagamentoIdInGroupedByTipoTransacao(ordemPagamentoIds, user?.cpfCnpj, request);
  }

  @Get('transacoes-dias-anteriores')
  @UseGuards(AuthGuard('jwt'))
  @SerializeOptions({ groups: ['me'] })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiQuery(CommonApiParams.userId)
  async getTransacoesDiasAnteriores(
    @Request() request: IRequest, //
    @Query('userId', new ParseNumberPipe({ min: 1, optional: false })) userId: number | null,
  ): Promise<OrdemPagamentoPendenteNuncaRemetidasDto[]> {
    this.logger.log(getRequestLog(request));
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const userIdNum = isUserIdNumber ? Number(userId) : request.user.id;
    canProceed(request, Number(userId));
    return this.ordemPagamentoService.findOrdensPagamentosPendentesQueNuncaForamRemetidas(userIdNum);
  }

}
