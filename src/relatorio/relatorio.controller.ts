import { Controller, Get, HttpCode, HttpException, HttpStatus, ParseArrayPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ParseBooleanPipe } from 'src/utils/pipes/parse-boolean.pipe';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { RelatorioNovoRemessaService } from './novo-remessa/relatorio-novo-remessa.service';

@ApiTags('Cnab')
@Controller({
  path: 'cnab/relatorio',
  version: '1',
})
export class RelatorioController {
  constructor(
    private relatorioNovoRemessaService: RelatorioNovoRemessaService,
  ) { }

  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: true, type: String })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: true, type: String })
  @ApiQuery({ name: 'favorecidoNome', description: 'Pesquisa o nome dos favorecidos', required: false, type: [String] })
  @ApiQuery({ name: 'consorcioNome', description: 'Pesquisa o nome da associação', required: false, type: [String] })
  @ApiQuery({ name: 'valorMin', description: 'Somatório do valor bruto mínimo', required: false, type: Number })
  @ApiQuery({ name: 'valorMax', description: 'Somatório do valor bruto máximo', required: false, type: Number })
  @ApiQuery({ name: 'pago', required: false, type: Boolean })
  @ApiQuery({ name: 'aPagar', required: false, type: Boolean })
  @ApiQuery({ name: 'emProcessamento', required: false, type: Boolean })
  @ApiQuery({ name: 'rejeitado', required: false, type: Boolean })
  @ApiQuery({ name: 'estorno', required: false, type: Boolean })
  @ApiQuery({ name: 'pendenciaPaga', required: false, type: Boolean })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('consolidadoGuardador')
  async getConsolidadoGuardador(
    @Query('dataInicio', new ParseDatePipe({ dateOnly: true }))
    dataInicio: Date,
    @Query('dataFim', new ParseDatePipe({ dateOnly: true }))
    dataFim: Date,
    @Query('favorecidoNome', new ParseArrayPipe({ items: String, separator: ',', optional: true }))
    favorecidoNome: string[],
    @Query('consorcioNome', new ParseArrayPipe({ items: String, separator: ',', optional: true }))
    consorcioNome: string[],
    @Query('valorMin', new ParseNumberPipe({ optional: true }))
    valorMin: number | undefined,
    @Query('valorMax', new ParseNumberPipe({ optional: true }))
    valorMax: number | undefined,
    @Query('pago', new ParseBooleanPipe({ optional: true })) pago: boolean | undefined,
    @Query('aPagar', new ParseBooleanPipe({ optional: true })) aPagar: boolean | undefined,
    @Query('emProcessamento', new ParseBooleanPipe({ optional: true })) emProcessamento: boolean | undefined,
    @Query('rejeitado', new ParseBooleanPipe({ optional: true })) rejeitado: boolean | undefined,
    @Query('estorno', new ParseBooleanPipe({ optional: true })) estorno: boolean | undefined,
    @Query('pendenciaPaga', new ParseBooleanPipe({ optional: true })) pendenciaPaga: boolean | undefined,
  ) {
    try {
      const result = await this.relatorioNovoRemessaService.findConsolidadoGuardador({
        dataInicio,
        dataFim,
        favorecidoNome,
        consorcioNome,
        valorMin,
        valorMax,
        pago,
        aPagar,
        emProcessamento,
        rejeitado,
        estorno,
        pendenciaPaga,
      });
      return result;
    } catch (e) {
      return new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: true, type: String })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: true, type: String })
  @ApiQuery({ name: 'tipo', description: 'Debito ou Credito', required: false, type: String })
  @ApiQuery({ name: 'operacao', description: 'Tipos de Operação', required: false, type: String })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('extrato')
  async getExtrato(
    @Query('dataInicio', new ParseDatePipe({ dateOnly: true }))
    dataInicio: Date,
    @Query('dataFim', new ParseDatePipe({ dateOnly: true }))
    dataFim: Date,
    @Query('tipo') tipo: string,
    @Query('operacao') operacao: string,
    @Query('conta') conta: string
  ) {
    try {
      const result = await this.relatorioNovoRemessaService.findExtrato({
        dataInicio, dataFim, tipo, operacao, conta
      });
      return result;
    } catch (e) {
      return new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }
}