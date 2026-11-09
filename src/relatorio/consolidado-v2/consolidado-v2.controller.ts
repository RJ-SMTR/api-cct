import { Controller, Get, HttpException, HttpStatus, ParseArrayPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Int32 } from 'typeorm';
import { ParseBooleanPipe } from 'src/utils/pipes/parse-boolean.pipe';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { ConsorcioAggregatorService } from './consorcio-aggregator.service';
import { VanzeiroAggregatorService } from './vanzeiro-aggregator.service';

// Parametros fora do escopo da fatia 1 (ADR 0022) - eleicao, Pendencia Paga/Pendentes,
// Erro/Rejeitado/Estorno, STUC-Gratuidade, paginacao. Enviar qualquer um deles com valor truthy
// e' erro explicito (nunca ignorado silenciosamente - decisao do PRD-consolidado-v2.md).
const OUT_OF_SCOPE_FLAGS = ['eleicao', 'desativados', 'pendentes', 'rejeitado', 'estorno', 'pendenciaPaga', 'stucGratuidade', 'erro'] as const;

@ApiTags('Cnab')
@Controller({
  path: 'cnab/relatorio-novo-remessa',
  version: '2',
})
export class ConsolidadoV2Controller {
  constructor(
    private readonly vanzeiroAggregatorService: VanzeiroAggregatorService,
    private readonly consorcioAggregatorService: ConsorcioAggregatorService,
  ) {}

  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: true, type: String })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: true, type: String })
  @ApiQuery({ name: 'userIds', description: 'Pesquisa o id dos usuários.', required: false, type: [Number] })
  @ApiQuery({ name: 'consorcioNome', description: 'Pesquisa o nome exato dos consórcios.', required: false, type: [String] })
  @ApiQuery({ name: 'valorMin', required: false, type: Number })
  @ApiQuery({ name: 'valorMax', required: false, type: Number })
  @ApiQuery({ name: 'pago', required: false, type: Boolean })
  @ApiQuery({ name: 'aPagar', required: false, type: Boolean })
  @ApiQuery({ name: 'emProcessamento', required: false, type: Boolean })
  @ApiQuery({ name: 'todosVanzeiros', required: false, type: Boolean })
  @ApiQuery({ name: 'todosConsorcios', required: false, type: Boolean })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('consolidado')
  async getConsolidado(
    @Query('dataInicio', new ParseDatePipe({ dateOnly: true }))
    dataInicio: Date,
    @Query('dataFim', new ParseDatePipe({ dateOnly: true }))
    dataFim: Date,
    @Query('userIds', new ParseArrayPipe({ items: Int32, separator: ',', optional: true }))
    userIds: number[] | undefined,
    @Query('consorcioNome', new ParseArrayPipe({ items: String, separator: ',', optional: true }))
    consorcioNome: string[] | undefined,
    @Query('valorMin', new ParseNumberPipe({ optional: true }))
    valorMin: number | undefined,
    @Query('valorMax', new ParseNumberPipe({ optional: true }))
    valorMax: number | undefined,
    @Query('pago', new ParseBooleanPipe({ optional: true })) pago: boolean | undefined,
    @Query('aPagar', new ParseBooleanPipe({ optional: true })) aPagar: boolean | undefined,
    @Query('emProcessamento', new ParseBooleanPipe({ optional: true })) emProcessamento: boolean | undefined,
    @Query('todosVanzeiros', new ParseBooleanPipe({ optional: true })) todosVanzeiros: boolean | undefined,
    @Query('todosConsorcios', new ParseBooleanPipe({ optional: true })) todosConsorcios: boolean | undefined,
    @Query('eleicao', new ParseBooleanPipe({ optional: true })) eleicao: boolean | undefined,
    @Query('desativados', new ParseBooleanPipe({ optional: true })) desativados: boolean | undefined,
    @Query('pendentes', new ParseBooleanPipe({ optional: true })) pendentes: boolean | undefined,
    @Query('rejeitado', new ParseBooleanPipe({ optional: true })) rejeitado: boolean | undefined,
    @Query('estorno', new ParseBooleanPipe({ optional: true })) estorno: boolean | undefined,
    @Query('pendenciaPaga', new ParseBooleanPipe({ optional: true })) pendenciaPaga: boolean | undefined,
    @Query('stucGratuidade', new ParseBooleanPipe({ optional: true })) stucGratuidade: boolean | undefined,
    @Query('erro', new ParseBooleanPipe({ optional: true })) erro: boolean | undefined,
  ) {
    const outOfScope: Record<string, boolean | undefined> = {
      eleicao,
      desativados,
      pendentes,
      rejeitado,
      estorno,
      pendenciaPaga,
      stucGratuidade,
      erro,
    };
    const offendingFlag = OUT_OF_SCOPE_FLAGS.find((flag) => outOfScope[flag]);
    if (offendingFlag) {
      throw new HttpException(
        { error: `"${offendingFlag}" não é suportado por esta rota ainda (fora do escopo da fatia 1, ADR 0022)` },
        HttpStatus.BAD_REQUEST,
      );
    }

    // userIds (filtro por favorecido especifico): BasePagamentoRepository ainda nao filtra por
    // userId - esse filtro e' escopo do T3 do ADR 0021 ("Filtros de Favorecido, Consorcio e
    // Modal"), em andamento em paralelo (nao done ainda quando esta rota foi escrita). Rejeitar
    // explicitamente em vez de aceitar e ignorar silenciosamente.
    if (userIds?.length) {
      throw new HttpException(
        { error: 'Filtro por userIds ainda não é suportado por esta rota (depende do T3 do ADR 0021 de filtros de favorecido)' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const statuses = [
      ...(pago ? [StatusPagamento.PAGO] : []),
      ...(aPagar ? [StatusPagamento.A_PAGAR] : []),
      ...(emProcessamento ? [StatusPagamento.AGUARDANDO_PAGAMENTO] : []),
    ];

    const filter = {
      dataInicio,
      dataFim,
      valorMin,
      valorMax,
      statuses: statuses.length > 0 ? statuses : undefined,
    };

    // Mesma regra implicita do legado (temFiltroConsorcio/temFiltroVanzeiros em
    // findConsolidado, relatorio-novo-remessa-consolidado.repository.ts:881-886): um filtro de
    // consorcio explicito direciona para a visao por consorcio; senao, por favorecido.
    const temFiltroConsorcio = Boolean(consorcioNome?.length) || Boolean(todosConsorcios);

    if (temFiltroConsorcio) {
      return this.consorcioAggregatorService.aggregate(filter, { consorcioNome, todosConsorcios });
    }

    return this.vanzeiroAggregatorService.aggregate(filter);
  }
}
