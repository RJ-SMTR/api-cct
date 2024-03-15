import {
  Controller,
  Get,
  Post,
  HttpCode,
  Query,
  // SerializeOptions,
  UseGuards,
  Put,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiBody, ApiTags } from '@nestjs/swagger';
import { Request, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LancamentoService } from './lancamento.service';
import { Body } from '@nestjs/common';
import { ItfLancamento } from './interfaces/lancamento.interface';
import { CreateLancamentoDto } from './createLancamentoDto';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ClienteFavorecidoService } from 'src/cnab/service/cliente-favorecido.service';


@ApiTags('Lancamento')
@Controller({
  path: 'lancamento',
  version: '1',
})
export class LancamentoController {
  constructor(
    private readonly lancamentoService: LancamentoService,
    private readonly clienteFavorecidoService: ClienteFavorecidoService
    ) {}

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
  async getLancamento(
    @Request() request,
    @Query('mes') mes: number,
    @Query('periodo') periodo: number,
    @Query('ano') ano: number,
  ): Promise<ItfLancamento[]> {
    return await this.lancamentoService.findByPeriod(mes, periodo, ano);
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
  @ApiBody({ type: CreateLancamentoDto })
  @HttpCode(HttpStatus.CREATED)
  @Post('/create')
  async createLancamento(
    @Request() req,
    @Body() lancamentoData: ItfLancamento,
  ): Promise<ItfLancamento> {
    console.log('/create');
    const userId = req.user.id;
    const createdLancamento = await this.lancamentoService.create(
      lancamentoData,
      userId,
    );
    return createdLancamento;
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master,
    RoleEnum.admin_finan,
    RoleEnum.aprovador_financeiro,
  )
  @Put('/authorize')
  @ApiQuery({
    name: 'lancamentoId',
    required: true,
    description: 'Id do lançamento',
  })
  @HttpCode(HttpStatus.OK)
  async autorizarPagamento(@Request() req) {
    const userId = req.user.id;
    const lancamentoId = req.query.lancamentoId;
    return await this.lancamentoService.autorizarPagamento(
      userId,
      lancamentoId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    RoleEnum.master, 
    RoleEnum.admin_finan, 
    RoleEnum.lancador_financeiro,
    RoleEnum.aprovador_financeiro)
  @Put('/')
  @ApiBody({ type: CreateLancamentoDto })
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'lancamentoId',
    required: true,
    description: 'Id do lançamento',
  })
  async atualizaLancamento(
    @Request() req,
    @Body() lancamentoData: ItfLancamento,
  ) {
    const id = req.query.lancamentoId;
    const userId = req.user.id;
    return await this.lancamentoService.update(id, lancamentoData, userId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master, RoleEnum.admin_finan, RoleEnum.lancador_financeiro)
  @Get('/:id')
  @HttpCode(HttpStatus.OK)
  async getById(@Param('id') id: number) {
    console.log('GET BY ID', id);
    return await this.lancamentoService.getById(id);
  }
}
