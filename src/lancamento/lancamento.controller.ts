import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { ParseBooleanPipe } from 'src/utils/pipes/parse-boolean.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { AutorizaLancamentoDto } from './dtos/AutorizaLancamentoDto';
import { LancamentoInputDto } from './dtos/lancamento-input.dto';
import { Lancamento } from './entities/lancamento.entity';
import { LancamentoService } from './lancamento.service';

@ApiTags('Lancamento')
@Controller({
  path: 'lancamento',
  version: '1',
})
export class LancamentoController {
  constructor(private readonly lancamentoService: LancamentoService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @Get('/')
  @ApiQuery({ name: 'mes', type: Number, required: false, description: 'Mês do lançamento' })
  @ApiQuery({ name: 'periodo', type: Number, required: false, description: ApiDescription({ _: 'Período do lançamento. Primeira quinzena ou segunda quinzena.', min: 1, max: 2 }) })
  @ApiQuery({ name: 'ano', type: Number, required: false, description: 'Ano do lançamento.' })
  @ApiQuery({ name: 'autorizado', type: Boolean, required: false, description: 'Fitra se foi autorizado ou não.' })
  @HttpCode(HttpStatus.OK)
  async get(
    @Request() request, //
    @Query('mes') mes: number,
    @Query('periodo', new ParseNumberPipe({ min: 1, max: 2, optional: true })) periodo: number | undefined,
    @Query('ano') ano: number,
    @Query('autorizado') autorizado: boolean | undefined,
  ): Promise<Lancamento[]> {
    return await this.lancamentoService.find({ mes, periodo, ano, autorizado });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @Get('/getbystatus')
  @ApiQuery({ name: 'autorizado', type: Boolean, required: true, description: 'Fitra se foi autorizado ou não.' })
  @HttpCode(HttpStatus.OK)
  async getByStatus(
    @Request() request, //
    @Query('autorizado', new ParseBooleanPipe()) autorizado: boolean | undefined,
  ): Promise<Lancamento[]> {
    const _autorizado = autorizado as boolean;
    return await this.lancamentoService.findByStatus(_autorizado);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @Get('/getValorAutorizado')
  @ApiQuery({ name: 'mes', required: true, description: 'Mês do lançamento' })
  @ApiQuery({ name: 'periodo', required: true, description: 'Período do lançamento. primeira quinzena ou segunda quinzena.' })
  @ApiQuery({ name: 'ano', required: true, description: 'Ano do lançamento.' })
  @HttpCode(HttpStatus.OK)
  async getValorAutorizado(
    @Request() request, //
    @Query('mes') mes: number,
    @Query('periodo') periodo: number,
    @Query('ano') ano: number,
  ): Promise<any> {
    return await this.lancamentoService.getValorAutorizado(mes, periodo, ano);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @ApiBody({ type: LancamentoInputDto })
  @HttpCode(HttpStatus.CREATED)
  @Post('/create')
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
    @Request() req,
    @Query('lancamentoId', new ParseNumberPipe({ min: 1 })) lancamentoId: number,
    @Body() lancamentoDto: LancamentoInputDto, // It was ItfLancamento
  ) {
    lancamentoDto.author = { id: req.user.id };
    return await this.lancamentoService.update(lancamentoId, lancamentoDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, //
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @Get('/:id')
  @HttpCode(HttpStatus.OK)
  async getId(@Param('id') id: number) {
    return await this.lancamentoService.getById(id);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteId(@Param('id') id: number) {
    return await this.lancamentoService.delete(id);
  }
}
