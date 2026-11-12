import { Injectable } from '@nestjs/common';
import { RelatorioConsolidadoNovoRemessaData, RelatorioConsolidadoNovoRemessaDto } from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { BasePagamentoFilter, BasePagamentoRepository, BasePagamentoRow, Perfil } from '../movimentacao-financeira-v2/base/base-pagamento.repository';

export interface VanzeiroAggregatorOptions {
  // So pessoas fisicas: mesmo recorte de length(operadoraCpfCnpj)<=11 do "todosVanzeiros" legado.
  somenteIndividuais?: boolean;
}

// Lista do Consolidado em ordem alfabetica do nome, em qualquer combinacao de filtro (consorcios,
// favorecidos ou a uniao das duas visoes).
export function ordenarPorNome(data: RelatorioConsolidadoNovoRemessaData[]): RelatorioConsolidadoNovoRemessaData[] {
  return [...data].sort((a, b) => (a.nomefavorecido ?? '').localeCompare(b.nomefavorecido ?? '', 'pt-BR'));
}

export function somarSemFavorecido(rows: BasePagamentoRow[]): number {
  return rows.filter((row) => row.nomes === null).reduce((total, row) => total + Number(row.valor), 0);
}

@Injectable()
export class VanzeiroAggregatorService {
  constructor(private readonly basePagamentoRepository: BasePagamentoRepository) {}

  // Agrega por "nomes" (nome completo do favorecido), replicando GROUP BY "nome" de
  // getQueryVanzeiros (relatorio-novo-remessa-consolidado.repository.ts) - nao por cpfCnpj, que
  // nao e unico (ADR 0019). Nao inventa correcao para esse caso aqui (fora de escopo da fatia).
  async aggregate(
    filter: BasePagamentoFilter,
    perfil: Perfil = 'permissionario',
    options: VanzeiroAggregatorOptions = {},
  ): Promise<RelatorioConsolidadoNovoRemessaDto> {
    // valorMin/valorMax valem sobre o total do favorecido no periodo e sao aplicados abaixo, depois
    // da soma, porque valorAPagar so considera os favorecidos que ficam dentro dos limites.
    const { valorMin, valorMax, ...baseFilter } = filter;
    // ADR 0023: totals per favorecido come from the database, never every row of the period.
    const { grupos, valorSemFavorecido } = await this.basePagamentoRepository.findTotaisPorFavorecido(perfil, baseFilter, {
      somenteIndividuais: options.somenteIndividuais,
    });

    const filtered = grupos.filter((favorecido) => {
      if (valorMin !== undefined && favorecido.valor < valorMin) {
        return false;
      }
      if (valorMax !== undefined && favorecido.valor > valorMax) {
        return false;
      }
      return true;
    });

    const data = ordenarPorNome(
      filtered.map(
        (favorecido) =>
          new RelatorioConsolidadoNovoRemessaData({
            valor: favorecido.valor,
            nomefavorecido: favorecido.nome,
            cpfCnpj: favorecido.cpfCnpj,
          }),
      ),
    );

    // valorAPagar: A Pagar dos favorecidos que sobreviveram ao filtro de valorMin/valorMax acima.
    const valorAPagar = filtered.reduce((total, favorecido) => total + favorecido.valorAPagar, 0);

    const valor = data.reduce((total, favorecido) => total + favorecido.valor, 0);

    return new RelatorioConsolidadoNovoRemessaDto({
      count: data.length,
      valor,
      valorAPagar,
      valorSemFavorecido,
      data,
    });
  }
}
