import {
  Controller,
  Get,
  Post,
  HttpCode,
  Query,
  // SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiBody, ApiTags } from '@nestjs/swagger';
import { Request, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LancamentoService } from './lancamento.service';
import { Body } from '@nestjs/common';
import { ItfLancamento } from './interfaces/lancamento.interface';
import { CreateLancamentoDto } from './createLancamentoDto';

@ApiTags('Lancamento')
@Controller({
  path: 'lancamento',
  version: '1',
})
export class LancamentoController {
  constructor(private readonly lancamentoService: LancamentoService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
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
  @HttpCode(HttpStatus.OK)
  async getLancamento(
    @Request() request,
    @Query('mes') mes: number,
    @Query('periodo') periodo: number,
    @Query('ano') ano: number,
  ): Promise<ItfLancamento[]> {
    return await this.lancamentoService.findByPeriod(mes, periodo, ano);
  }

  @Post('/')
  @ApiBody({ type: CreateLancamentoDto })
  @HttpCode(HttpStatus.CREATED)
  async createLancamento(
    @Body() lancamentoData: ItfLancamento,
  ): Promise<ItfLancamento> {
    const createdLancamento = await this.lancamentoService.create(
      lancamentoData,
    );
    return createdLancamento;
  }
}
