import { Controller, Get, Header, HttpCode, HttpException, HttpStatus, ParseArrayPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { ParseBooleanPipe } from 'src/utils/pipes/parse-boolean.pipe';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { Int32 } from 'typeorm';
import { ValidationPipe } from '@nestjs/common';
import { FinancialMovementQueryDto } from '../dtos/pay-and-pending-query.dto';
import { RelatorioNovoRemessaFinancialMovementService } from '../movimentacao-financeira/relatorio-novo-remessa-financial-movement.service';
import { RelatorioNovoRemessaService } from './relatorio-novo-remessa.service';

@ApiTags('Cnab')
@Controller({
  path: 'cnab/relatorio-novo-remessa',
  version: '1',
})
export class RelatorioNovoRemessaController {
  constructor(
    private relatorioNovoRemessaService: RelatorioNovoRemessaService,
    private relatorioNovoRemessaFinancialMovementService: RelatorioNovoRemessaFinancialMovementService
  ) { }

  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: true, type: String })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: true, type: String })
  @ApiQuery({ name: 'userIds', description: 'Pesquisa o id dos usuários.', required: false, type: [Number] })
  @ApiQuery({ name: 'consorcioNome', description: ApiDescription({ _: 'Pesquisa o nome exato dos consórcios, sem distinção de acento ou maiúsculas.', 'STPC/STPL': 'Agrupa todos os vanzeiros sob o consórcio' }), required: false, type: [String] })
  @ApiQuery({ name: 'valorMin', description: 'Somatório do valor bruto.', required: false, type: Number })
  @ApiQuery({ name: 'valorMax', description: 'Somatório do valor bruto.', required: false, type: Number })
  @ApiQuery({ name: 'pago', required: false, type: Boolean, description: ApiDescription({ _: 'Se o pagamento foi pago com sucesso.', default: false }) })
  @ApiQuery({ name: 'aPagar', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status for a pagar', default: false }) })
  @ApiQuery({ name: 'emProcessamento', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status for a emProcessamento', default: false }) })
  @ApiQuery({ name: 'erro', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status do pagamento é de erro', default: false }) })
  @ApiQuery({ name: 'todosVanzeiros', required: false, type: Boolean, description: ApiDescription({ _: 'Se a pesquisa deve ser feita para todos os vanzeiros', default: false }) })
  @ApiQuery({ name: 'todosConsorcios', required: false, type: Boolean, description: ApiDescription({ _: 'Se a pesquisa deve ser feita para todos os consórcios', default: false }) })
  @ApiQuery({ name: 'eleicao', required: false, type: Boolean, description: ApiDescription({ _: 'eleicao', default: false }) })
  @ApiQuery({ name: 'desativados', required: false, type: Boolean, description: ApiDescription({ _: 'desativados', default: false }) })
  @ApiQuery({ name: 'pendentes', required: false, type: Boolean, description: ApiDescription({ _: 'pendentes', default: false }) })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('consolidado')
  async getConsolidado(
    @Query('dataInicio', new ParseDatePipe({ dateOnly: true }))
    dataInicio: Date,
    @Query('dataFim', new ParseDatePipe({ dateOnly: true }))
    dataFim: Date,
    @Query('userIds', new ParseArrayPipe({ items: Int32, separator: ',', optional: true }))
    userIds: number[],
    @Query('consorcioNome', new ParseArrayPipe({ items: String, separator: ',', optional: true }))
    consorcioNome: string[],
    @Query('valorMin', new ParseNumberPipe({ optional: true }))
    valorMin: number | undefined,
    @Query('valorMax', new ParseNumberPipe({ optional: true }))
    valorMax: number | undefined,
    @Query('pago', new ParseBooleanPipe({ optional: true })) pago: boolean | undefined,
    @Query('aPagar', new ParseBooleanPipe({ optional: true })) aPagar: boolean | undefined,
    @Query('emProcessamento', new ParseBooleanPipe({ optional: true })) emProcessamento: boolean | undefined,
    @Query('erro', new ParseBooleanPipe({ optional: true })) erro: boolean | undefined,
    @Query('todosVanzeiros', new ParseBooleanPipe({ optional: true })) todosVanzeiros: boolean | undefined,
    @Query('todosConsorcios', new ParseBooleanPipe({ optional: true })) todosConsorcios: boolean | undefined,
    @Query('eleicao', new ParseBooleanPipe({ optional: true })) eleicao: boolean | undefined,
    @Query('desativados', new ParseBooleanPipe({ optional: true })) desativados: boolean | undefined,
    @Query('pendentes', new ParseBooleanPipe({ optional: true })) pendentes: boolean | undefined,
  ) {
    try {
      const result = await this.relatorioNovoRemessaService.findConsolidado({
        dataInicio, dataFim, userIds, consorcioNome, valorMin, valorMax, pago, aPagar, emProcessamento, erro, todosVanzeiros, todosConsorcios, eleicao, desativados, pendentes
      });
      return result;
    } catch (e) {
      return new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: true, type: String })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: true, type: String })
  @ApiQuery({ name: 'userIds', description: 'Pesquisa o id dos usuários.', required: false, type: [Number] })
  @ApiQuery({ name: 'consorcioNome', description: ApiDescription({ _: 'Pesquisa o nome parcial dos consórcios, sem distinção de acento ou maiúsculas.', 'STPC/STPL': 'Agrupa todos os vanzeiros sob o consórcio' }), required: false, type: String })
  @ApiQuery({ name: 'valorMin', description: 'Somatório do valor bruto.', required: false, type: Number })
  @ApiQuery({ name: 'valorMax', description: 'Somatório do valor bruto.', required: false, type: Number })
  @ApiQuery({ name: 'pago', required: false, type: Boolean, description: ApiDescription({ _: 'Se o pagamento foi pago com sucesso.', default: false }) })
  @ApiQuery({ name: 'aPagar', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status for a pagar', default: false }) })
  @ApiQuery({ name: 'emProcessamento', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status for a emProcessamento', default: false }) })
  @ApiQuery({ name: 'erro', required: false, type: Boolean, description: ApiDescription({ _: 'Se o status do pagamento é de erro', default: false }) })
  @ApiQuery({ name: 'todosVanzeiros', required: false, type: Boolean, description: ApiDescription({ _: 'Se a pesquisa deve ser feita para todos os vanzeiros', default: false }) })
  @ApiQuery({ name: 'todosConsorcios', required: false, type: Boolean, description: ApiDescription({ _: 'Se a pesquisa deve ser feita para todos os consórcios', default: false }) })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('sintetico')
  @Header('Cache-Control', 'no-store')
  async getSintetico(
    @Query('dataInicio', new ParseDatePipe({ dateOnly: true }))
    dataInicio: Date,
    @Query('dataFim', new ParseDatePipe({ dateOnly: true }))
    dataFim: Date,
    @Query('userIds', new ParseArrayPipe({ items: Int32, separator: ',', optional: true }))
    userIds: number[],
    @Query('consorcioNome', new ParseArrayPipe({ items: String, separator: ',', optional: true }))
    consorcioNome: string[],
    @Query('valorMin', new ParseNumberPipe({ optional: true }))
    valorMin: number | undefined,
    @Query('valorMax', new ParseNumberPipe({ optional: true }))
    valorMax: number | undefined,
    @Query('pago', new ParseBooleanPipe({ optional: true })) pago: boolean | undefined,
    @Query('aPagar', new ParseBooleanPipe({ optional: true })) aPagar: boolean | undefined,
    @Query('emProcessamento', new ParseBooleanPipe({ optional: true })) emProcessamento: boolean | undefined,
    @Query('erro', new ParseBooleanPipe({ optional: true })) erro: boolean | undefined,
    @Query('todosVanzeiros', new ParseBooleanPipe({ optional: true })) todosVanzeiros: boolean | undefined,
    @Query('todosConsorcios', new ParseBooleanPipe({ optional: true })) todosConsorcios: boolean | undefined,
  ) {
    try {
      const result = await this.relatorioNovoRemessaService.findSintetico({
        dataInicio, dataFim, userIds, consorcioNome, valorMin, valorMax, pago, aPagar, emProcessamento, erro, todosVanzeiros, todosConsorcios
      });
      return result;
    } catch (e) {
      return new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('financial-movement')
  async getFinancialMovement(
    @Query(new ValidationPipe({ transform: true })) queryParams: FinancialMovementQueryDto,
  ) {
    try {
      const result = await this.relatorioNovoRemessaFinancialMovementService.findFinancialMovement(queryParams);
      return result;
    } catch (e) {
      return new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }
}