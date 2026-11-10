import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { RelatorioConsolidadoNovoRemessaData, RelatorioConsolidadoNovoRemessaDto } from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { StucGratuidadeFilter, StucGratuidadeRepository } from '../movimentacao-financeira-v2/stuc-gratuidade/stuc-gratuidade.repository';

// STUC - Gratuidade (T3 do ADR 0021, fatia 2): diferente de VanzeiroAggregatorService/
// ConsorcioAggregatorService, nao agrega "um favorecido somando o periodo" - cada linha da
// resposta e' uma janela de pagamento (StucGratuidadeRepository.findRows + pivotStucGratuidadeRows,
// T8 do ADR 0021, ja' faz o pivot e aplica valorMin/valorMax pos-pivot). Este servico so' mapeia
// o shape pivotado para RelatorioConsolidadoNovoRemessaDto. O filtro de consorcio vai para o
// repositorio e continua devolvendo uma linha por favorecido, como o ramo STUC do legado.
export type StucGratuidadeAggregatorFilter = StucGratuidadeFilter;

@Injectable()
export class StucGratuidadeAggregatorService {
  constructor(private readonly stucGratuidadeRepository: StucGratuidadeRepository) {}

  async aggregate(filter: StucGratuidadeAggregatorFilter): Promise<RelatorioConsolidadoNovoRemessaDto> {
    const rows = await this.stucGratuidadeRepository.findRows(filter);

    // DTO expõe as colunas de data como string (dd/MM/yyyy, mesmo formato do legado
    // findConsolidadoStucGratuidade) - o pivot devolve Date | null.
    const formatDate = (value: Date | null) => (value ? format(value, 'dd/MM/yyyy') : null);

    const data = rows.map(
      (row) =>
        new RelatorioConsolidadoNovoRemessaData({
          valor: row.valor,
          nomefavorecido: row.nomes,
          cpfCnpj: row.cpfCnpj,
          dataOrdemPagamento1: formatDate(row.dataOrdemPagamento1),
          valorOrdemPagamento1: row.valorOrdemPagamento1,
          dataOrdemPagamento2: formatDate(row.dataOrdemPagamento2),
          valorOrdemPagamento2: row.valorOrdemPagamento2,
          dataOrdemPagamento3: formatDate(row.dataOrdemPagamento3),
          valorOrdemPagamento3: row.valorOrdemPagamento3,
          dataOrdemPagamento4: formatDate(row.dataOrdemPagamento4),
          valorOrdemPagamento4: row.valorOrdemPagamento4,
        }),
    );

    const valorAPagar = rows
      .filter((row) => row.status === StatusPagamento.A_PAGAR)
      .reduce((total, row) => total + row.valor, 0);

    const valor = data.reduce((total, row) => total + row.valor, 0);

    return new RelatorioConsolidadoNovoRemessaDto({
      count: data.length,
      valor,
      valorAPagar,
      data,
    });
  }
}
