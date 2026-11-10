import { Injectable } from '@nestjs/common';
import { RelatorioConsolidadoNovoRemessaData, RelatorioConsolidadoNovoRemessaDto } from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { BasePagamentoFilter, BasePagamentoRepository, Perfil } from '../movimentacao-financeira-v2/base/base-pagamento.repository';

interface FavorecidoAccumulator {
  nome: string;
  cpfCnpj: string | null;
  valor: number;
}

@Injectable()
export class VanzeiroAggregatorService {
  constructor(private readonly basePagamentoRepository: BasePagamentoRepository) {}

  // Agrega por "nomes" (nome completo do favorecido), replicando GROUP BY "nome" de
  // getQueryVanzeiros (relatorio-novo-remessa-consolidado.repository.ts) - nao por cpfCnpj, que
  // nao e unico (ADR 0019). Nao inventa correcao para esse caso aqui (fora de escopo da fatia).
  async aggregate(filter: BasePagamentoFilter, perfil: Perfil = 'permissionario'): Promise<RelatorioConsolidadoNovoRemessaDto> {
    // valorMin/valorMax nao sao passados para findGroupedRows aqui: o legado
    // (relatorio-novo-remessa-consolidado.repository.ts:957-966) filtra com HAVING SUM(valor)
    // depois do GROUP BY "nome" final (soma do favorecido no PERIODO TODO) - uma granularidade
    // mais grossa que o filtro de BasePagamentoRepository (por favorecido/dia/status dentro de
    // cada fonte, ADR 0002). Aplicar valorMin/valorMax la filtraria linhas individuais antes
    // desta soma, divergindo da paridade exigida; o filtro correto entra depois, sobre o total
    // ja agregado por favorecido (ver abaixo).
    const { valorMin, valorMax, ...baseFilter } = filter;
    const rows = await this.basePagamentoRepository.findGroupedRows(perfil, baseFilter);

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

    const data = filtered.map(
      (favorecido) =>
        new RelatorioConsolidadoNovoRemessaData({
          valor: favorecido.valor,
          nomefavorecido: favorecido.nome,
          cpfCnpj: favorecido.cpfCnpj,
        }),
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
      data,
    });
  }
}
