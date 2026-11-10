import { Controller, Get, HttpException, HttpStatus, ParseArrayPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Int32 } from 'typeorm';
import { ParseBooleanPipe } from 'src/utils/pipes/parse-boolean.pipe';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { RelatorioNovoRemessaService } from '../novo-remessa/relatorio-novo-remessa.service';
import { ConsolidadoCombinadoService } from './consolidado-combinado.service';
import { ConsorcioAggregatorService } from './consorcio-aggregator.service';
import { EleicaoAggregatorService } from './eleicao-aggregator.service';
import { StucGratuidadeAggregatorService } from './stuc-gratuidade-aggregator.service';
import { VanzeiroAggregatorService } from './vanzeiro-aggregator.service';


interface StatusFlags {
  pendentes?: boolean;
  pago?: boolean;
  aPagar?: boolean;
  emProcessamento?: boolean;
  pendenciaPaga?: boolean;
  rejeitado?: boolean;
  estorno?: boolean;
  erro?: boolean;
}

// Mesma semantica do getSelectedStatuses legado: erro=true e' o combo Estorno + Rejeitado, e o
// Set remove duplicatas quando erro e' combinado com rejeitado/estorno isolados.
function mapStatuses(flags: StatusFlags): StatusPagamento[] | undefined {
  const statuses = [
    ...new Set([
      ...(flags.pago ? [StatusPagamento.PAGO] : []),
      ...(flags.aPagar ? [StatusPagamento.A_PAGAR] : []),
      ...(flags.pendentes ? [StatusPagamento.PENDENTES] : []),
      ...(flags.emProcessamento ? [StatusPagamento.AGUARDANDO_PAGAMENTO] : []),
      ...(flags.pendenciaPaga ? [StatusPagamento.PENDENCIA_PAGA] : []),
      ...(flags.rejeitado ? [StatusPagamento.ERRO_REJEITADO] : []),
      ...(flags.estorno ? [StatusPagamento.ERRO_ESTORNO] : []),
      ...(flags.erro ? [StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO] : []),
    ]),
  ];

  return statuses.length > 0 ? statuses : undefined;
}

@ApiTags('Cnab')
@Controller({
  path: 'cnab/relatorio-novo-remessa',
  version: '2',
})
export class ConsolidadoV2Controller {
  constructor(
    private readonly vanzeiroAggregatorService: VanzeiroAggregatorService,
    private readonly consorcioAggregatorService: ConsorcioAggregatorService,
    private readonly eleicaoAggregatorService: EleicaoAggregatorService,
    private readonly stucGratuidadeAggregatorService: StucGratuidadeAggregatorService,
    private readonly consolidadoCombinadoService: ConsolidadoCombinadoService,
    private readonly relatorioNovoRemessaService: RelatorioNovoRemessaService,
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
  @ApiQuery({ name: 'pendenciaPaga', required: false, type: Boolean })
  @ApiQuery({ name: 'pendentes', required: false, type: Boolean })
  @ApiQuery({ name: 'rejeitado', required: false, type: Boolean })
  @ApiQuery({ name: 'estorno', required: false, type: Boolean })
  @ApiQuery({ name: 'erro', description: 'Combo Estorno + Rejeitado', required: false, type: Boolean })
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
    // STUC-Gratuidade e Eleicao: mesmo resultado da rota v1 (decisao de Rayanne, 2026-11-10), pela
    // propria implementacao do legado.
    if (stucGratuidade || eleicao) {
      return this.relatorioNovoRemessaService.findConsolidado({
        dataInicio,
        dataFim,
        userIds,
        consorcioNome,
        valorMin,
        valorMax,
        pago,
        aPagar,
        emProcessamento,
        erro,
        todosVanzeiros,
        todosConsorcios,
        eleicao,
        desativados,
        pendentes,
        rejeitado,
        estorno,
        pendenciaPaga,
        stucGratuidade,
      });
    }

    // Como no legado, todosVanzeiros tem prioridade sobre o favorecido especifico.
    const favorecidos = todosVanzeiros ? undefined : userIds;
    const temFiltroConsorcio = Boolean(consorcioNome?.length) || Boolean(todosConsorcios);

    const filter = {
      dataInicio,
      dataFim,
      valorMin,
      valorMax,
      statuses: mapStatuses({ pago, aPagar, emProcessamento, pendentes, pendenciaPaga, rejeitado, estorno, erro }),
      desativados,
    };

    // Como no legado: so favorecido ou so consorcio selecionado mostra uma visao; os dois juntos, ou
    // nenhum, unem as visoes de favorecido e de consorcio.
    const temFiltroFavorecido = Boolean(favorecidos?.length) || Boolean(todosVanzeiros);
    if (temFiltroConsorcio === temFiltroFavorecido) {
      return this.consolidadoCombinadoService.aggregate(
        filter,
        temFiltroConsorcio ? { userIds: favorecidos, todosVanzeiros, consorcioNome, todosConsorcios } : undefined,
      );
    }

    if (temFiltroConsorcio) {
      return this.consorcioAggregatorService.aggregate(filter, { consorcioNome, todosConsorcios });
    }

    return this.vanzeiroAggregatorService.aggregate({ ...filter, userIds: favorecidos });
  }

  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: true, type: String })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: true, type: String })
  @ApiQuery({ name: 'valorMin', required: false, type: Number })
  @ApiQuery({ name: 'valorMax', required: false, type: Number })
  @ApiQuery({ name: 'pago', required: false, type: Boolean })
  @ApiQuery({ name: 'aPagar', required: false, type: Boolean })
  @ApiQuery({ name: 'emProcessamento', required: false, type: Boolean })
  @ApiQuery({ name: 'pendenciaPaga', required: false, type: Boolean })
  @ApiQuery({ name: 'rejeitado', required: false, type: Boolean })
  @ApiQuery({ name: 'estorno', required: false, type: Boolean })
  @ApiQuery({ name: 'erro', description: 'Combo Estorno + Rejeitado', required: false, type: Boolean })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiQuery({ name: 'userIds', description: 'Pesquisa o id dos usuários.', required: false, type: [Number] })
  @Get('guardador/consolidado')
  async getGuardadorConsolidado(
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
    // Guardador nao tem visao por consorcio, Eleicao nem STUC-Gratuidade (PRD, AC-8/AC-9): erro
    // explicito, nunca ignorado silenciosamente.
    const naoSuportados: Record<string, boolean> = {
      eleicao: Boolean(eleicao),
      stucGratuidade: Boolean(stucGratuidade),
      desativados: Boolean(desativados),
      pendentes: Boolean(pendentes),
    };
    const parametroInvalido = Object.keys(naoSuportados).find((parametro) => naoSuportados[parametro]);
    if (parametroInvalido) {
      throw new HttpException({ error: `"${parametroInvalido}" não é suportado pela rota de Guardador` }, HttpStatus.BAD_REQUEST);
    }

    const filter = {
      dataInicio,
      dataFim,
      valorMin,
      valorMax,
      statuses: mapStatuses({ pago, aPagar, emProcessamento, pendenciaPaga, rejeitado, estorno, erro }),
      userIds,
      consorcioNome,
      todosConsorcios,
    };

    return this.vanzeiroAggregatorService.aggregate(filter, 'guardador');
  }
}
