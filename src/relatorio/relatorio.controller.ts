import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, ParseArrayPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { ParseBooleanPipe } from 'src/utils/pipes/parse-boolean.pipe';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { RelatorioService } from './relatorio.service';
import { RelatorioNovoRemessaDetalhadoService } from './relatorio-novo-remessa-detalhado.service';

@ApiTags('Cnab')
@Controller({
  path: 'cnab/relatorio',
  version: '1',
})
export class RelatorioController {
  constructor(
    private relatorioService: RelatorioService,
    private relatorioNovoRemessaDetalhadoService: RelatorioNovoRemessaDetalhadoService
  ) { }

  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: true, type: String })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: true, type: String })
  @ApiQuery({ name: 'favorecidoNome', description: 'Pesquisa o nome parcial dos favorecidos, sem distinção de acento ou maiúsculas.', required: false, type: String })
  @ApiQuery({ name: 'consorcioNome', description: ApiDescription({ _: 'Pesquisa o nome parcial dos consórcios, sem distinção de acento ou maiúsculas.', 'STPC/STPL': 'Agrupa todos os vanzeiros sob o consórcio' }), required: false, type: String })
  @ApiQuery({ name: 'valorMin', description: 'Somatório do valor bruto.', required: false, type: Number })
  @ApiQuery({ name: 'valorMax', description: 'Somatório do valor bruto.', required: false, type: Number })
  @ApiQuery({ name: 'pago', required: false, type: Boolean, description: ApiDescription({ _: 'Se o pagamento foi pago com sucesso.', default: false }) })
  @ApiQuery({ name: 'aPagar', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status for a pagar', default: false }) })
  @ApiQuery({ name: 'emProcessamento', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status for a emProcessamento', default: false }) })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('consolidado')
  async getConsolidado(
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
    @Query('emProcessamento', new ParseBooleanPipe({ optional: true })) emProcessamento: boolean | undefined
  ) {
    try {
      const result = await this.relatorioService.findConsolidado({
        dataInicio, dataFim, favorecidoNome, consorcioNome, valorMin, valorMax, pago, aPagar, emProcessamento
      });
      return result;
    } catch (e) {
      return new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: true, type: String })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: true, type: String })
  @ApiQuery({ name: 'favorecidoNome', description: 'Pesquisa o nome parcial dos favorecidos, sem distinção de acento ou maiúsculas.', required: false, type: String })
  @ApiQuery({ name: 'consorcioNome', description: ApiDescription({ _: 'Pesquisa o nome parcial dos consórcios, sem distinção de acento ou maiúsculas.', 'STPC/STPL': 'Agrupa todos os vanzeiros sob o consórcio' }), required: false, type: String })
  @ApiQuery({ name: 'valorMin', description: 'Somatório do valor bruto.', required: false, type: Number })
  @ApiQuery({ name: 'valorMax', description: 'Somatório do valor bruto.', required: false, type: Number })
  @ApiQuery({ name: 'pago', required: false, type: Boolean, description: ApiDescription({ _: 'Se o pagamento foi pago com sucesso.', default: false }) })
  @ApiQuery({ name: 'aPagar', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status for a pagar', default: false }) })
  @ApiQuery({ name: 'emProcessamento', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status for em Processamento', default: false }) })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('sintetico')
  async getSintetico(
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
    @Query('emProcessamento', new ParseBooleanPipe({ optional: true })) emProcessamento: boolean | undefined
  ) {
    try {
      const result = await this.relatorioService.findSintetico({
        dataInicio, dataFim, favorecidoNome, consorcioNome, valorMin, valorMax, pago, aPagar, emProcessamento
      });
      return result;
    } catch (e) {
      return new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: true, type: String })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: true, type: String })
  @ApiQuery({ name: 'favorecidoNome', description: 'Pesquisa o nome parcial dos favorecidos, sem distinção de acento ou maiúsculas.', required: false, type: String })
  @ApiQuery({ name: 'consorcioNome', description: ApiDescription({ _: 'Pesquisa o nome parcial dos consórcios, sem distinção de acento ou maiúsculas.', 'STPC/STPL': 'Agrupa todos os vanzeiros sob o consórcio' }), required: false, type: String })
  @ApiQuery({ name: 'valorMin', description: 'Somatório do valor bruto.', required: false, type: Number })
  @ApiQuery({ name: 'valorMax', description: 'Somatório do valor bruto.', required: false, type: Number })
  @ApiQuery({ name: 'pago', required: false, type: Boolean, description: ApiDescription({ _: 'Se o pagamento foi pago com sucesso.', default: false }) })
  @ApiQuery({ name: 'aPagar', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status for a pagar', default: false }) })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('analitico')
  async getAnalitico(
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
    @Query('aPagar', new ParseBooleanPipe({ optional: true })) aPagar: boolean | undefined
  ) {
    try {
      const result = await this.relatorioService.findAnalitico({
        dataInicio, dataFim, favorecidoNome, consorcioNome, valorMin, valorMax, pago, aPagar
      });
      return result;
    } catch (e) {
      return new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: true, type: String })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: true, type: String })
  @ApiQuery({ name: 'consorcioNome', description: ApiDescription({ _: 'Pesquisa o nome parcial dos consórcios, sem distinção de acento ou maiúsculas.', 'STPC/STPL': 'Agrupa todos os vanzeiros sob o consórcio' }), required: false, type: String })
  @ApiQuery({ name: 'valorMin', description: 'Somatório do valor bruto.', required: false, type: Number })

  @ApiQuery({ name: 'valorMax', description: 'Somatório do valor bruto.', required: false, type: Number })
  @ApiQuery({ name: 'pago', required: false, type: Boolean, description: ApiDescription({ _: 'Se o pagamento foi pago com sucesso.', default: false }) })
  @ApiQuery({ name: 'aPagar', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status for a pagar', default: false }) })
  @ApiQuery({ name: 'emProcessamento', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status for a emProcessamento', default: false }) })
  @ApiQuery({ name: 'erro', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status do pagamento é de erro', default: false }) })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('detalhado')
  async getDetalhado(
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
    @Query('erro', new ParseBooleanPipe({ optional: true })) erro: boolean | undefined
  ) {
    try {
      const result = await this.relatorioNovoRemessaDetalhadoService.findDetalhado({
        dataInicio, dataFim, consorcioNome, valorMin, valorMax, pago, aPagar, emProcessamento,
      });
      return result;
    } catch (e) {
      return new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }
}