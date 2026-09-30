import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param, ParseArrayPipe,
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
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { DateQueryParams } from 'src/utils/query-param/date.query-param';
import { PaginationQueryParams } from 'src/utils/query-param/pagination.query-param';
import { PaginationApiParams } from 'src/utils/api-param/pagination.api-param';
import { canProceed, getRequestLog } from 'src/utils/request-utils';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { OrdemPagamentoService } from '../service/ordem-pagamento.service';
import { OrdemPagamentoSemanalDto } from '../dto/ordem-pagamento-semanal.dto';
import { BigqueryTransacaoService } from '../../../bigquery/services/bigquery-transacao.service';
import { BigqueryTransacao } from '../../../bigquery/entities/transacao.bigquery-entity';
import { OrdemPagamentoMensalDto } from '../dto/ordem-pagamento-mensal.dto';
import { UsersService } from '../../../users/users.service';
import { BigqueryTransacaoDiario } from 'src/bigquery/entities/transaca-diario.entity';

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

  @Get()
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @ApiQuery(PaginationApiParams.page)
  @ApiQuery(PaginationApiParams.limit)
  @ApiQuery({ name: 'dataOrdemInicio', required: false, type: String })
  @ApiQuery({ name: 'dataOrdemFim', required: false, type: String })
  @ApiQuery({ name: 'nomeConsorcio', required: false, type: String })
  @ApiQuery({ name: 'nomeOperadora', required: false, type: String })
  @HttpCode(HttpStatus.OK)
  async getPaginado(
    @Query(...PaginationQueryParams.page) page: number,
    @Query(...PaginationQueryParams.limit) limit: number,
    // Tipado como `any` (não `Date`) propositalmente: com o ValidationPipe
    // global (`transform: true`), o Nest converteria o parâmetro para Date
    // ANTES do ParseDatePipe rodar, e um valor ausente viraria "Invalid Date"
    // em vez de undefined, quebrando a checagem `optional`.
    @Query('dataOrdemInicio', new ParseDatePipe({ dateOnly: true, optional: true, transform: true })) dataOrdemInicio?: any,
    @Query('dataOrdemFim', new ParseDatePipe({ dateOnly: true, optional: true, transform: true })) dataOrdemFim?: any,
    @Query('nomeConsorcio') nomeConsorcio?: string,
    @Query('nomeOperadora') nomeOperadora?: string,
  ) {
    return this.ordemPagamentoService.findPermissionarioListPaginated(page, limit, {
      dataOrdemInicio,
      dataOrdemFim,
      nomeConsorcio,
      nomeOperadora,
    });
  }

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


  @Get('semanal') 
  @UseGuards(AuthGuard('jwt'))
  @SerializeOptions({ groups: ['me'] })
  @ApiBearerAuth()
  // Alterado para ApiQuery, pois o dado virá na URL
  @ApiQuery({ name: 'ordemPagamentoAgrupadoIds', type: String, required: true })
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getSemanal(
    @Request() request: IRequest,
    // Agora recebemos via @Query
    @Query('ordemPagamentoAgrupadoIds') ordemPagamentoAgrupadoIds: string, 
    @Query(...DateQueryParams.yearMonth) yearMonth: string,
    @Query(...DateQueryParams.endDate) endDate: Date,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: false })) userId: number | null,
  ): Promise<OrdemPagamentoSemanalDto[]> {
    this.logger.log(getRequestLog(request));

    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const userIdNum = isUserIdNumber ? Number(userId) : request.user.id;

    canProceed(request, Number(userId));

    return this.ordemPagamentoService.findOrdensPagamentoAgrupadasByOrdemPagamentoAgrupadoId(
      ordemPagamentoAgrupadoIds,
      userIdNum,
      endDate,
    );
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
  ): Promise<BigqueryTransacaoDiario[]> {
    this.logger.log(getRequestLog(request));
    // const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    // const userIdNum = isUserIdNumber ? Number(userId) : request.user.id;
    // const user = await this.usersService.findOne({ id: userIdNum})
    canProceed(request, Number(userId));
    return this.bigqueryTransacaoService.findTransacoesByOp([ordemPagamentoId]);
    
  }

  @Get('diario')
  @UseGuards(AuthGuard('jwt'))
  @SerializeOptions({ groups: ['me'] })
  @ApiBearerAuth()
  @ApiQuery({ name: 'ordemPagamentoIds', type: [Number], required: true })
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getDiarioParaVariasOrdens(
    @Request() request: IRequest, //
    @Query('ordemPagamentoIds', new ParseArrayPipe()) ordemPagamentoIds: number[],
    // @Query('userId', new ParseNumberPipe({ min: 1, optional: false })) userId: number | null,
  ): Promise<BigqueryTransacaoDiario[]> {
    this.logger.log(getRequestLog(request));
    //return this.bigqueryTransacaoService.findManyByOrdemPagamentoIdInGroupedByTipoTransacao(ordemPagamentoIds,undefined,request)
    return this.bigqueryTransacaoService.findTransacoesByOp(ordemPagamentoIds);
  }


  @Get('transacoes-semana/:ordemPagamentoAgrupadoIds')
  @UseGuards(AuthGuard('jwt'))
  @SerializeOptions({ groups: ['me'] })
  @ApiBearerAuth()
  @ApiParam(CommonApiParams.ordemPagamentoAgrupadoIds)
  @ApiQuery(CommonApiParams.userId)
  @HttpCode(HttpStatus.OK)
  async getTransacoesSemana(
    @Request() request: IRequest, //
    @Param('ordemPagamentoAgrupadoIds', new ParseNumberPipe({ min: 1, optional: false })) ordemPagamentoAgrupadoIds: string,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: false })) userId: number | null,
  ): Promise<BigqueryTransacao[]> {
    this.logger.log(getRequestLog(request));
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const userIdNum = isUserIdNumber ? Number(userId) : request.user.id;
    canProceed(request, Number(userId));

    const ordensPagamento = await this.ordemPagamentoService.findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoIds, userIdNum);
    const ordemPagamentoIds = ordensPagamento.map((ordem) => ordem.ordemId);

    const user = await this.usersService.findOne({ id: userIdNum})
    return this.bigqueryTransacaoService.findManyByOrdemPagamentoIdInGroupedByTipoTransacao(ordemPagamentoIds, user?.cpfCnpj, request);
  }

  @Get('transacoes-dias-anteriores/:ordemPagamentoAgrupadoId')
  @UseGuards(AuthGuard('jwt'))
  @SerializeOptions({ groups: ['me'] })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiQuery(CommonApiParams.userId)
  async getTransacoesDiasAnteriores(
    @Request() request: IRequest, //
    @Param('ordemPagamentoAgrupadoId', new ParseNumberPipe({ min: 1, optional: false })) ordemPagamentoAgrupadoId: number,
    @Query('userId', new ParseNumberPipe({ min: 1, optional: false })) userId: number | null,
  ): Promise<OrdemPagamentoSemanalDto[]> {
    this.logger.log(getRequestLog(request));
    const isUserIdNumber = userId !== null && !isNaN(Number(userId));
    const userIdNum = isUserIdNumber ? Number(userId) : request.user.id;
    canProceed(request, Number(userId));
    return this.ordemPagamentoService.findOrdensPagamentoDiasAnterioresByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId, userIdNum);
  }

}
