import {
  Controller,
  Get,
  Post,
  HttpCode,
  Query,
  // SerializeOptions,
  UseGuards,
  Put,
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
  @ApiBody({ type: CreateLancamentoDto })
  @HttpCode(HttpStatus.CREATED)
  @Post('/')
  async createLancamento(
    @Body() lancamentoData: ItfLancamento,
  ): Promise<ItfLancamento> {
    const createdLancamento = await this.lancamentoService.create(
      lancamentoData,
    );
    return createdLancamento;
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
}
