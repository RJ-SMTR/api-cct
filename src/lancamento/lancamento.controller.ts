import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { LancamentoDto } from './dtos/lancamentoDto';
import { ItfLancamento } from './interfaces/lancamento.interface';
import { LancamentoService } from './lancamento.service';
import { AutorizaLancamentoDto } from './dtos/AutorizaLancamentoDto';

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
    RoleEnum.master,
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @Get('/')
  @ApiQuery({
    name: 'mes',
    required: false,
    description: 'Mês do lançamento',
  })
  @ApiQuery({
    name: 'periodo',
    required: false,
    description:
      'Período do lançamento. primeira quinzena ou segunda quinzena.',
  })
  @ApiQuery({
    name: 'ano',
    required: false,
    description: 'Ano do lançamento.',
  })
  @ApiQuery({
    name: 'autorizado',
    required: false,
    description:
      'use 1 ou 0 (ou deixe vazio) para filtrar por autorizado ou não autorizado.',
  })
  @HttpCode(HttpStatus.OK)
  async getLancamento(
    @Request() request,
    @Query('mes') mes: number,
    @Query('periodo') periodo: number,
    @Query('ano') ano: number,
    @Query('autorizado') authorized: number,
  ): Promise<ItfLancamento[]> {
    return await this.lancamentoService.findByPeriod(
      mes,
      periodo,
      ano,
      authorized,
    );
  }
  

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master,
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @Get('/getbystatus')
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'use 1 ou 0 para autorizado ou não autorizado.',
  })
  @HttpCode(HttpStatus.OK)
  async findByStatus(
    @Request() request,
    @Query('status') status: number,
  ): Promise<ItfLancamento[]> {
    return await this.lancamentoService.findByStatus(status);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master,
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @Get('/getValorAutorizado')
  @ApiQuery({
    name: 'mes',
    required: true,
    description: 'Mês do lançamento',
  })
  @ApiQuery({
    name: 'periodo',
    required: true,
    description:
      'Período do lançamento. primeira quinzena ou segunda quinzena.',
  })
  @ApiQuery({
    name: 'ano',
    required: true,
    description: 'Ano do lançamento.',
  })
  @HttpCode(HttpStatus.OK)
  async getValorAutorizado(
    @Request() request,
    @Query('mes') mes: number,
    @Query('periodo') periodo: number,
    @Query('ano') ano: number,
  ): Promise<any> {
    return await this.lancamentoService.getValorAutorizado(mes, periodo, ano);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master,
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @ApiBody({ type: LancamentoDto })
  @HttpCode(HttpStatus.CREATED)
  @Post('/create')
  async createLancamento(
    @Request() req: any,
    @Body() lancamentoData: LancamentoDto, // It was ItfLancamento
  ): Promise<ItfLancamento> {
    const userId = req.user.id;
    const createdLancamento = await this.lancamentoService.create(
      lancamentoData,
      userId,
    );
    return createdLancamento.toItfLancamento();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master, RoleEnum.admin_finan, RoleEnum.aprovador_financeiro)
  @Put('/authorize')
  @ApiQuery({
    name: 'lancamentoId',
    required: true,
    description: 'Id do lançamento',
  })
  @ApiBody({ type: AutorizaLancamentoDto })
  @HttpCode(HttpStatus.OK)
  async autorizarPagamento(
    @Request() req,
    @Body() autorizaLancamentoDto: AutorizaLancamentoDto,
  ) {
    const userId = req.user.id;
    const lancamentoId = req.query.lancamentoId;
    return await this.lancamentoService.autorizarPagamento(
      userId,
      lancamentoId,
      autorizaLancamentoDto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master,
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @Put('/')
  @ApiBody({ type: LancamentoDto })
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'lancamentoId',
    required: true,
    description: 'Id do lançamento',
  })
  async atualizaLancamento(
    @Request() req,
    @Body() lancamentoData: LancamentoDto, // It was ItfLancamento
  ) {
    const id = req.query.lancamentoId;
    const userId = req.user.id;
    return await this.lancamentoService.update(id, lancamentoData, userId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master,
    RoleEnum.admin_finan,
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro,
  )
  @Get('/:id')
  @HttpCode(HttpStatus.OK)
  async getById(@Param('id') id: number) {
    return await this.lancamentoService.getById(id);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteById(@Param('id') id: number) {
    return await this.lancamentoService.delete(id);
  }
}