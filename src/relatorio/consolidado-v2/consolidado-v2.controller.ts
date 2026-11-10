import { Controller, Get, HttpException, HttpStatus, ParseArrayPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Int32 } from 'typeorm';
import { ParseBooleanPipe } from 'src/utils/pipes/parse-boolean.pipe';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
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
    // Como no legado, todosVanzeiros tem prioridade sobre o favorecido especifico.
    const favorecidos = todosVanzeiros ? undefined : userIds;
    const temFiltroConsorcio = Boolean(consorcioNome?.length) || Boolean(todosConsorcios);

    // O legado une as visoes de favorecido e consorcio nesse caso; aqui ainda nao ha essa uniao.
    if (favorecidos?.length && temFiltroConsorcio) {
      throw new HttpException(
        { error: '"userIds" não pode ser combinado com "consorcioNome"/"todosConsorcios" nesta rota' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const filter = {
      dataInicio,
      dataFim,
      valorMin,
      valorMax,
      statuses: mapStatuses({ pago, aPagar, emProcessamento, pendentes, pendenciaPaga, rejeitado, estorno, erro }),
      desativados,
    };

    // STUC vem antes de Eleicao: no legado (findConsolidado), stucGratuidade tem prioridade sobre
    // os demais tipos de consulta.
    // STUC - Gratuidade: o filtro de consorcio vai para o repositorio; a resposta segue com uma
    // linha por favorecido, como o legado.
    if (stucGratuidade) {
      // STUC nao tem fonte de Pendentes (ADR 0004): sozinho, o legado devolveria todos os status.
      if (pendentes || desativados) {
        throw new HttpException({ error: '"stucGratuidade" não pode ser combinado com "pendentes"/"desativados"' }, HttpStatus.BAD_REQUEST);
      }
      return this.stucGratuidadeAggregatorService.aggregate({ ...filter, userIds: favorecidos, consorcioNome, todosConsorcios });
    }

    // Eleicao: filtro de consorcio seleciona a visao por consorcio; senao, por favorecido.
    if (eleicao) {
      const filtroEleicao = { ...filter, userIds: favorecidos, consorcioNome, todosConsorcios };
      return temFiltroConsorcio ? this.eleicaoAggregatorService.aggregateByConsorcio(filtroEleicao) : this.eleicaoAggregatorService.aggregateByFavorecido(filtroEleicao);
    }

    // Mesma regra implicita do legado (temFiltroConsorcio/temFiltroVanzeiros em
    // findConsolidado, relatorio-novo-remessa-consolidado.repository.ts:881-886): um filtro de
    // consorcio explicito direciona para a visao por consorcio; senao, por favorecido.
    if (todosVanzeiros && todosConsorcios) {
      return this.consolidadoCombinadoService.aggregate(filter);
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
