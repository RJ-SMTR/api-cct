import { Injectable } from '@nestjs/common';
import { RelatorioConsolidadoNovoRemessaDto } from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { BasePagamentoFilter } from '../movimentacao-financeira-v2/base/base-pagamento.repository';
import { ConsorcioAggregatorService } from './consorcio-aggregator.service';
import { VanzeiroAggregatorService } from './vanzeiro-aggregator.service';

// todosVanzeiros + todosConsorcios: as linhas de consorcio e as dos individuais de modal aparecem
// juntas, mas o individual ja esta dentro do total do consorcio (somarValorSemDuplicidade do
// findConsolidado legado). Regra do legado: havendo qualquer consorcio no resultado, so os
// consorcios somam; sem nenhum (filtro de valor), somam os individuais (achado 2026-11-06).
@Injectable()
export class ConsolidadoCombinadoService {
  constructor(
    private readonly consorcioAggregatorService: ConsorcioAggregatorService,
    private readonly vanzeiroAggregatorService: VanzeiroAggregatorService,
  ) {}

  async aggregate(filter: BasePagamentoFilter): Promise<RelatorioConsolidadoNovoRemessaDto> {
    const [consorcios, individuais] = await Promise.all([
      this.consorcioAggregatorService.aggregate(filter, { todosConsorcios: true }),
      this.vanzeiroAggregatorService.aggregate(filter, 'permissionario', { somenteIndividuais: true }),
    ]);

    const fonteDoTotal = consorcios.data.length > 0 ? consorcios : individuais;
    const data = [...consorcios.data, ...individuais.data].sort((a, b) => a.nomefavorecido.localeCompare(b.nomefavorecido));

    return new RelatorioConsolidadoNovoRemessaDto({
      count: data.length,
      valor: fonteDoTotal.valor,
      valorAPagar: fonteDoTotal.valorAPagar,
      valorSemFavorecido: consorcios.valorSemFavorecido,
      data,
    });
  }
}
