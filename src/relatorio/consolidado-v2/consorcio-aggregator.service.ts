import { Injectable } from '@nestjs/common';
import { RelatorioConsolidadoNovoRemessaData, RelatorioConsolidadoNovoRemessaDto } from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { BasePagamentoFilter, BasePagamentoRepository } from '../movimentacao-financeira-v2/base/base-pagamento.repository';
import { ordenarPorNome, somarSemFavorecido } from './vanzeiro-aggregator.service';

interface ConsorcioAccumulator {
  nomeConsorcio: string;
  valor: number;
}

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
    // consorcioNome/todosConsorcios precisam chegar a findGroupedRows: sem nenhum dos dois, a base
    // restringe aos modais (STPC/STPL/TEC) e exclui os CNPJs institucionais, o que esvaziaria a
    // visao por consorcio. A base tambem faz a comparacao sem diferenciar maiusculas, como o legado.
    const todasAsLinhas = await this.basePagamentoRepository.findGroupedRows('permissionario', {
      ...baseFilter,
      consorcioNome: options.consorcioNome,
      todosConsorcios: options.todosConsorcios,
    });
    const rows = todasAsLinhas.filter((row) => row.nomes !== null);

    const totalsByConsorcio = new Map<string, ConsorcioAccumulator>();

    for (const row of rows) {
      if (row.nomeConsorcio === null) {
        continue;
      }

      const valor = Number(row.valor);
      const existing = totalsByConsorcio.get(row.nomeConsorcio);
      if (existing) {
        existing.valor += valor;
      } else {
        totalsByConsorcio.set(row.nomeConsorcio, { nomeConsorcio: row.nomeConsorcio, valor });
      }
    }

    const filtered = [...totalsByConsorcio.values()].filter((consorcio) => {
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
            nomefavorecido: consorcio.nomeConsorcio,
          }),
      ),
    );

    const consorciosFiltrados = new Set(filtered.map((consorcio) => consorcio.nomeConsorcio));
    const valorAPagar = rows
      .filter(
        (row) =>
          row.status === StatusPagamento.A_PAGAR && row.nomeConsorcio !== null && consorciosFiltrados.has(row.nomeConsorcio),
      )
      .reduce((total, row) => total + Number(row.valor), 0);

    const valor = data.reduce((total, consorcio) => total + consorcio.valor, 0);

    return new RelatorioConsolidadoNovoRemessaDto({
      count: data.length,
      valor,
      valorAPagar,
      valorSemFavorecido: somarSemFavorecido(todasAsLinhas),
      data,
    });
  }
}
