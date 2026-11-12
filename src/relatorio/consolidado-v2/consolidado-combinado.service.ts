import { Injectable } from '@nestjs/common';
import { RelatorioConsolidadoNovoRemessaDto } from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { BasePagamentoFilter } from '../movimentacao-financeira-v2/base/base-pagamento.repository';
import { MODAIS } from '../movimentacao-financeira-v2/status/consorcio-resolver';
import { ConsorcioAggregatorService } from './consorcio-aggregator.service';
import { ordenarPorNome, VanzeiroAggregatorService } from './vanzeiro-aggregator.service';

export interface ConsolidadoUniaoOptions {
  userIds?: number[];
  todosVanzeiros?: boolean;
  consorcioNome?: string[];
  todosConsorcios?: boolean;
}

// Favorecido e consorcio selecionados juntos: o legado (findConsolidado) une as duas visoes. Com
// todosVanzeiros e um consorcio que cobre os modais, o individual de modal ja esta dentro do total
// do consorcio (somarValorSemDuplicidade): havendo consorcio no resultado, so os consorcios somam;
// sem nenhum (filtro de valor), somam os individuais (achado 2026-11-06). Fora desse caso, as duas
// visoes somam.
@Injectable()
export class ConsolidadoCombinadoService {
  constructor(
    private readonly consorcioAggregatorService: ConsorcioAggregatorService,
    private readonly vanzeiroAggregatorService: VanzeiroAggregatorService,
  ) {}

  async aggregate(
    filter: BasePagamentoFilter,
    options: ConsolidadoUniaoOptions = { todosVanzeiros: true, todosConsorcios: true },
  ): Promise<RelatorioConsolidadoNovoRemessaDto> {
    const { userIds, todosVanzeiros, consorcioNome, todosConsorcios } = options;
    const [consorcios, favorecidos] = await Promise.all([
      this.consorcioAggregatorService.aggregate(filter, { consorcioNome, todosConsorcios }),
      this.vanzeiroAggregatorService.aggregate({ ...filter, userIds }, 'permissionario', { somenteIndividuais: Boolean(todosVanzeiros) }),
    ]);

    const consorcioCobreModais = Boolean(todosConsorcios) || Boolean(consorcioNome?.some((nome) => MODAIS.includes(nome.trim().toUpperCase())));
    const podeTerDuplicidade = Boolean(todosVanzeiros) && consorcioCobreModais;
    const fonteDoTotal = podeTerDuplicidade ? (consorcios.data.length > 0 ? consorcios : favorecidos) : undefined;
    const data = ordenarPorNome([...consorcios.data, ...favorecidos.data]);

    return new RelatorioConsolidadoNovoRemessaDto({
      count: data.length,
      valor: fonteDoTotal ? fonteDoTotal.valor : consorcios.valor + favorecidos.valor,
      valorAPagar: fonteDoTotal ? fonteDoTotal.valorAPagar : consorcios.valorAPagar + favorecidos.valorAPagar,
      valorSemFavorecido: consorcios.valorSemFavorecido,
      data,
    });
  }
}
