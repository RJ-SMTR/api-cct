import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { ParseBooleanPipe } from 'src/utils/pipes/parse-boolean.pipe';
import { ParseEnumPipe } from 'src/utils/pipes/parse-enum.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { AutorizaLancamentoDto } from './dtos/AutorizaLancamentoDto';
import { LancamentoInputDto } from './dtos/lancamento-input.dto';
import { Lancamento } from './entities/lancamento.entity';
import { LancamentoStatus } from './enums/lancamento-status.enum';
import { LancamentoService } from './lancamento.service';
import { DateMonth, humanMonthToDateMonth } from 'src/utils/types/date-month.type';
import { HumanMonth } from 'src/utils/types/human-month.type';

@ApiTags('Lancamento')
@Controller({
  path: 'lancamento',
  version: '1',
})
export class LancamentoController {
  constructor(private readonly lancamentoService: LancamentoService) {}

  @Get('/')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @ApiBearerAuth()
  @ApiQuery({ name: 'periodo', type: Number, required: false, description: ApiDescription({ _: 'Período do lançamento.', values: '\n\n- `1`: Primeira quinzena (dias 1-15)\n\n- `2`: segunda quinzena (dias 16 até o fim do mês)' }) })
  @ApiQuery({ name: 'mes', type: Number, required: false, description: ApiDescription({ _: 'Mês do lançamento' }) })
  @ApiQuery({ name: 'ano', type: Number, required: false, description: ApiDescription({ _: 'Ano do lançamento.' }) })
  @ApiQuery({ name: 'autorizado', type: Boolean, required: false, description: 'Fitra se foi autorizado ou não.' })
  @ApiQuery({ name: 'pago', type: Boolean, required: false, description: 'Fitra se foi autorizado ou não.' })
  @ApiQuery({ name: 'status', enum: LancamentoStatus, required: false, description: 'Fitra por status.' })
  async get(
    @Request() request, //
    @Query('periodo', new ParseNumberPipe({ min: 1, max: 2, optional: true })) periodo: number | undefined,
    @Query('mes', new ParseNumberPipe({ min: 1, max: 12, optional: true })) _mes: HumanMonth | undefined,
    @Query('ano') ano: number | undefined,
    @Query('autorizado', new ParseBooleanPipe({ optional: true })) autorizado: boolean | undefined,
    @Query('pago', new ParseBooleanPipe({ optional: true })) pago: boolean | undefined,
    @Query('status', new ParseEnumPipe(LancamentoStatus, { optional: true })) status: LancamentoStatus | undefined,
  ): Promise<Lancamento[]> {
    const mes = _mes && humanMonthToDateMonth(_mes);
    return await this.lancamentoService.find({ data_lancamento: { mes, periodo, ano }, autorizado, pago, status });
  }

  @Get('/getbystatus')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @ApiOperation({ description: 'Pesquisar Lançamentos pelo status' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'autorizado', type: Boolean, required: true, description: 'Fitra se foi autorizado ou não.' })
  async getByStatus(
    @Request() request, //
    @Query('autorizado', new ParseBooleanPipe()) autorizado: boolean | undefined,
  ): Promise<Lancamento[]> {
    const _autorizado = autorizado as boolean;
    return await this.lancamentoService.findByStatus(_autorizado);
  }

  @Get('/getValorAutorizado')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @ApiOperation({ description: 'Obter a soma dos valores dos Lançamentos.' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'mes', required: true, description: ApiDescription({ _: 'Mês do lançamento', min: 1, max: 12 }) })
  @ApiQuery({ name: 'periodo', required: true, description: ApiDescription({ _: 'Período do lançamento.', values: '\n\n- `1`: Primeira quinzena (dias 1-15)\n\n- `2`: segunda quinzena (dias 16 até o fim do mês)' }) })
  @ApiQuery({ name: 'ano', required: true, description: 'Ano do lançamento.' })
  @ApiOperation({ description: `Inclui uma autorização do usuário autenticado para o Lançamento.` })
  async getValorAutorizado(
    @Request() request, //
    @Query('mes', new ParseNumberPipe({ min: 1, max: 12 })) _mes: HumanMonth,
    @Query('periodo') periodo: number,
    @Query('ano') ano: number,
  ): Promise<any> {
    const mes = humanMonthToDateMonth(_mes);
    return await this.lancamentoService.getValorAutorizado(mes, periodo, ano);
  }

  @Post('/create')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @ApiBearerAuth()
  @ApiBody({ type: LancamentoInputDto })
  async postCreateLancamento(
    @Request() req: any, //
    @Body() lancamentoDto: LancamentoInputDto,
  ): Promise<Lancamento> {
    lancamentoDto.author = { id: req.user.id };
    const createdLancamento = await this.lancamentoService.create(lancamentoDto);
    return createdLancamento;
  }

  @Put('/authorize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.aprovador_financeiro,
  )
  @ApiOperation({ description: `Inclui uma autorização do usuário autenticado para o Lançamento.` })
  @ApiBearerAuth()
  @ApiQuery({ name: 'lancamentoId', required: true, description: 'Id do lançamento' })
  @ApiBody({ type: AutorizaLancamentoDto })
  async putAutorizarPagamento(
    @Request() req, //
    @Body() autorizaLancamentoDto: AutorizaLancamentoDto,
  ) {
    const userId = req.user.id;
    const lancamentoId = req.query.lancamentoId;
    return await this.lancamentoService.autorizarPagamento(userId, lancamentoId, autorizaLancamentoDto);
  }

  @Put('/')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @ApiBearerAuth()
  @ApiBody({ type: LancamentoInputDto })
  @ApiQuery({ name: 'lancamentoId', required: true, description: 'Id do lançamento' })
  async putLancamento(
    @Request() req: IRequest,
    @Query('lancamentoId', new ParseNumberPipe({ min: 1 })) lancamentoId: number,
    @Body() lancamentoDto: LancamentoInputDto, // It was ItfLancamento
  ) {
    lancamentoDto.author = { id: req.user.id };
    return await this.lancamentoService.updateDto(lancamentoId, lancamentoDto);
  }

  @Get('/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @ApiBearerAuth()
  async getId(@Param('id') id: number) {
    return await this.lancamentoService.getById(id);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @ApiBearerAuth()
  async deleteId(@Param('id') id: number) {
    return await this.lancamentoService.deleteId(id);
  }
}
