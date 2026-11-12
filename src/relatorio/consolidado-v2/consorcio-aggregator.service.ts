import { Injectable } from '@nestjs/common';
import { RelatorioConsolidadoNovoRemessaData, RelatorioConsolidadoNovoRemessaDto } from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { BasePagamentoFilter, BasePagamentoRepository } from '../movimentacao-financeira-v2/base/base-pagamento.repository';
import { ordenarPorNome } from './vanzeiro-aggregator.service';

export interface ConsorcioAggregatorOptions {
  // Mesmo papel do "Consórcio = Todos" do Consolidado atual: expande para a lista fixa
  // CONSORCIOS (ver consorcio-resolver.ts). Ignorado se consorcioNome tambem for passado.
  todosConsorcios?: boolean;
  consorcioNome?: string[];
}

@Injectable()
export class ConsorcioAggregatorService {
  constructor(private readonly basePagamentoRepository: BasePagamentoRepository) {}

  // Agrega por nomeConsorcio, replicando GROUP BY "nome" de getQueryConsorcios
  // (relatorio-novo-remessa-consolidado.repository.ts). Linhas sem nomeConsorcio resolvido
  // (null) saem da agregacao - mesmo comportamento do filtro `nome IS NOT NULL` do legado.
  async aggregate(filter: BasePagamentoFilter, options: ConsorcioAggregatorOptions = {}): Promise<RelatorioConsolidadoNovoRemessaDto> {
    // valorMin/valorMax: mesma razao do VanzeiroAggregatorService (T3) - o legado filtra com
    // HAVING SUM(valor) depois do GROUP BY "nome" final, nao linha a linha antes de somar.
    const { valorMin, valorMax, ...baseFilter } = filter;
    // consorcioNome/todosConsorcios precisam chegar a base: sem nenhum dos dois, ela restringe aos modais
    // (STPC/STPL/TEC) e exclui os CNPJs institucionais, o que esvaziaria a visao por consorcio. A base tambem
    // faz a comparacao sem diferenciar maiusculas, como o legado. ADR 0023: totais por consorcio vem do banco.
    const { grupos, valorSemFavorecido } = await this.basePagamentoRepository.findTotaisPorConsorcio({
      ...baseFilter,
      consorcioNome: options.consorcioNome,
      todosConsorcios: options.todosConsorcios,
    });

    const filtered = grupos.filter((consorcio) => {
      if (valorMin !== undefined && consorcio.valor < valorMin) {
        return false;
      }
      if (valorMax !== undefined && consorcio.valor > valorMax) {
        return false;
      }
      return true;
    });

    const data = ordenarPorNome(
      filtered.map(
        (consorcio) =>
          new RelatorioConsolidadoNovoRemessaData({
            valor: consorcio.valor,
            nomefavorecido: consorcio.nome,
          }),
      ),
    );

    const valorAPagar = filtered.reduce((total, consorcio) => total + consorcio.valorAPagar, 0);
    const valor = data.reduce((total, consorcio) => total + consorcio.valor, 0);

    return new RelatorioConsolidadoNovoRemessaDto({
      count: data.length,
      valor,
      valorAPagar,
      valorSemFavorecido,
      data,
    });
  }
}
