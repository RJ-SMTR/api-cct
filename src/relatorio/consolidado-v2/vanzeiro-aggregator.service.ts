import { Injectable } from '@nestjs/common';
import { RelatorioConsolidadoNovoRemessaData, RelatorioConsolidadoNovoRemessaDto } from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { BasePagamentoFilter, BasePagamentoRepository, BasePagamentoRow, Perfil } from '../movimentacao-financeira-v2/base/base-pagamento.repository';

interface FavorecidoAccumulator {
  nome: string;
  cpfCnpj: string | null;
  valor: number;
}

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
    const allRows = await this.basePagamentoRepository.findGroupedRows(perfil, baseFilter);
    const comFavorecido = allRows.filter((row) => row.nomes !== null);
    const rows = options.somenteIndividuais ? comFavorecido.filter((row) => row.cpfCnpj && row.cpfCnpj.length <= 11) : comFavorecido;
    const valorSemFavorecido = somarSemFavorecido(allRows);

    const totalsByFavorecido = new Map<string, FavorecidoAccumulator>();

    for (const row of rows) {
      const valor = Number(row.valor);

      const existing = totalsByFavorecido.get(row.nomes);
      if (existing) {
        existing.valor += valor;
      } else {
        totalsByFavorecido.set(row.nomes, { nome: row.nomes, cpfCnpj: row.cpfCnpj, valor });
      }
    }

    const filtered = [...totalsByFavorecido.values()].filter((favorecido) => {
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

    // valorAPagar: soma das linhas A Pagar, restrita aos favorecidos que sobreviveram ao
    // filtro de valorMin/valorMax acima (nao os descartados).
    const favorecidosFiltrados = new Set(filtered.map((favorecido) => favorecido.nome));
    const valorAPagar = rows
      .filter((row) => row.status === StatusPagamento.A_PAGAR && favorecidosFiltrados.has(row.nomes))
      .reduce((total, row) => total + Number(row.valor), 0);

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
