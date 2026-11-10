import { Injectable } from '@nestjs/common';
import { RelatorioConsolidadoNovoRemessaData, RelatorioConsolidadoNovoRemessaDto } from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { BasePagamentoFilter, BasePagamentoRepository, BasePagamentoRow } from '../movimentacao-financeira-v2/base/base-pagamento.repository';

export type EleicaoAggregatorFilter = Pick<BasePagamentoFilter, 'dataInicio' | 'dataFim' | 'statuses' | 'valorMin' | 'valorMax'>;

interface Accumulator {
  nome: string;
  cpfCnpj: string | null;
  valor: number;
}

// Eleição (T2 da fatia 2, OQ-1 resolvido como (b)): findEleicaoRows (T7 do ADR 0021) não aceita
// userIds/consorcioNome/todosConsorcios - não ha filtro por favorecido/consorcio especifico
// nesta task, so' o total de todos no periodo. Por isso este servico e' dedicado (nao
// VanzeiroAggregatorService/ConsorcioAggregatorService por dentro - assinatura diferente de
// BasePagamentoFilter) mas segue o mesmo padrao de agregacao em memoria dessas duas classes.
@Injectable()
export class EleicaoAggregatorService {
  constructor(private readonly basePagamentoRepository: BasePagamentoRepository) {}

  // Agrega por "nomes" (favorecido), replicando GROUP BY "nome" de getQueryEleicaoVanzeiro
  // (relatorio-novo-remessa-consolidado.repository.ts), sobre as linhas de findEleicaoRows.
  async aggregateByFavorecido(filter: EleicaoAggregatorFilter): Promise<RelatorioConsolidadoNovoRemessaDto> {
    const rows = await this.basePagamentoRepository.findEleicaoRows(filter);
    return this.aggregate(rows, (row) => row.nomes, (row) => row.cpfCnpj);
  }

  // Agrega por "nomeConsorcio" (valor bruto de opu."consorcio", sem CASE de resolucao de modal -
  // Eleicao nao tem esse conceito, ver T2.md), replicando GROUP BY "nome" de
  // getQueryEleicaoConsorcio. Linhas sem nomeConsorcio (null) saem da agregacao, mesmo
  // comportamento do filtro `nome IS NOT NULL` do legado e do ConsorcioAggregatorService (T3).
  async aggregateByConsorcio(filter: EleicaoAggregatorFilter): Promise<RelatorioConsolidadoNovoRemessaDto> {
    const rows = await this.basePagamentoRepository.findEleicaoRows(filter);
    const rowsComConsorcio = rows.filter((row) => row.nomeConsorcio !== null);
    return this.aggregate(rowsComConsorcio, (row) => row.nomeConsorcio as string, () => null);
  }

  private aggregate(
    rows: BasePagamentoRow[],
    keyOf: (row: BasePagamentoRow) => string,
    cpfCnpjOf: (row: BasePagamentoRow) => string | null,
  ): RelatorioConsolidadoNovoRemessaDto {
    const totals = new Map<string, Accumulator>();

    for (const row of rows) {
      const key = keyOf(row);
      const valor = Number(row.valor);

      const existing = totals.get(key);
      if (existing) {
        existing.valor += valor;
      } else {
        totals.set(key, { nome: key, cpfCnpj: cpfCnpjOf(row), valor });
      }
    }

    const data = [...totals.values()].map(
      (item) =>
        new RelatorioConsolidadoNovoRemessaData({
          valor: item.valor,
          nomefavorecido: item.nome,
          cpfCnpj: item.cpfCnpj,
        }),
    );

    const favorecidosOuConsorcios = new Set(data.map((item) => item.nomefavorecido));
    const valorAPagar = rows
      .filter((row) => row.status === StatusPagamento.A_PAGAR && favorecidosOuConsorcios.has(keyOf(row)))
      .reduce((total, row) => total + Number(row.valor), 0);

    const valor = data.reduce((total, item) => total + item.valor, 0);

    return new RelatorioConsolidadoNovoRemessaDto({
      count: data.length,
      valor,
      valorAPagar,
      data,
    });
  }
}
