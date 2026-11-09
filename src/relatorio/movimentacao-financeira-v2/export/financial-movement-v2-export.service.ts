import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import {
  FinancialMovementExportFormatValue,
  FinancialMovementExportResult,
  writeFinancialMovementExport,
} from '../../utils/financial-movement-export-writer';
import { buildSelectedStatusLabels } from '../../movimentacao-financeira/financial-movement-export.utils';
import {
  RelatorioFinancialMovementNovoRemessaData,
  RelatorioFinancialMovementNovoRemessaSummaryDto,
} from '../../dtos/relatorio-financial-and-movement.dto';
import { BasePagamentoCursor, BasePagamentoFilter, BasePagamentoRepository, BasePagamentoRow, Perfil } from '../base/base-pagamento.repository';
import { StucGratuidadeFilter, StucGratuidadeRepository } from '../stuc-gratuidade/stuc-gratuidade.repository';
import { resolveStucPaymentWindow } from '../../utils/stuc-payment-window.util';

// Export (CSV/XLSX/PDF), reescrito para consumir o formato de linha novo (T1-T8), adaptado
// na borda para o writer compartilhado (writeFinancialMovementExport) e as colunas existentes
// (BASE_COLUMNS/STUC_COLUMNS, financial-movement-export-writer.ts) - NENHUM dos dois e' tocado
// aqui de proposito: eles ainda servem o export das rotas antigas (em produção, ate o cutover
// do T12), e mudar as colunas mudaria o arquivo que o usuario final baixa hoje mesmo antes do
// cutover. Decisao de T9: adapter de borda (RelatorioFinancialMovementNovoRemessaData), nao
// renomear colunas - ver nota abaixo sobre os campos que a query nova genuinamente nao produz.
export type FinancialMovementV2ExportFilter = BasePagamentoFilter & {
  eleicao?: boolean;
  stucGratuidade?: boolean;
};

// Mesmo tamanho de lote do export legado (streamFinancialMovementRows, batchSize = 500) -
// mantem o uso de memoria limitado para periodos grandes (AC-21/Constraints).
export const FINANCIAL_MOVEMENT_V2_EXPORT_BATCH_SIZE = 500;

@Injectable()
export class FinancialMovementV2ExportService {
  constructor(
    private readonly basePagamentoRepository: BasePagamentoRepository,
    private readonly stucGratuidadeRepository: StucGratuidadeRepository,
  ) {}

  async downloadFinancialMovementExport(
    perfil: Perfil,
    filter: FinancialMovementV2ExportFilter & { format?: FinancialMovementExportFormatValue },
  ): Promise<FinancialMovementExportResult> {
    return writeFinancialMovementExport(
      filter.format ?? 'csv',
      'financial-movement-v2',
      (onRow) => this.streamExportRows(perfil, filter, onRow),
      {
        dataInicio: filter.dataInicio,
        dataFim: filter.dataFim,
        statusLabels: buildStatusLabelsFromFilter(filter.statuses),
      },
      Boolean(filter.stucGratuidade),
    );
  }

  // Roteia pela mesma exclusividade de filtro que T7/T8 ja documentam (Eleicao e STUC-
  // Gratuidade sao fontes/metodos separados de findGroupedRows). Se o filtro pedir os dois
  // simultaneamente (nao bloqueado no backend, ver T8-summary.md "exclusividade no app-cct,
  // nao no servidor") STUC-Gratuidade ganha - mesma prioridade que downloadFinancialMovementExport
  // legado da (stucGratuidade checado antes de eleicao/base).
  async streamExportRows(
    perfil: Perfil,
    filter: FinancialMovementV2ExportFilter,
    onRow: (row: RelatorioFinancialMovementNovoRemessaData) => Promise<void> | void,
  ): Promise<void> {
    if (filter.stucGratuidade) {
      await this.streamStucRows(filter, onRow);
      return;
    }
    if (filter.eleicao) {
      await this.streamEleicaoRows(filter, onRow);
      return;
    }
    await this.streamBaseRows(perfil, filter, onRow);
  }

  // Keyset pagination (T4) em lotes de FINANCIAL_MOVEMENT_V2_EXPORT_BATCH_SIZE - nunca
  // carrega o periodo inteiro de uma vez, mesma garantia de memoria do export legado.
  private async streamBaseRows(
    perfil: Perfil,
    filter: BasePagamentoFilter,
    onRow: (row: RelatorioFinancialMovementNovoRemessaData) => Promise<void> | void,
  ): Promise<void> {
    let cursor: BasePagamentoCursor | undefined;
    for (;;) {
      const page = await this.basePagamentoRepository.findGroupedRowsPage(perfil, filter, FINANCIAL_MOVEMENT_V2_EXPORT_BATCH_SIZE, cursor);
      for (const row of page.rows) await onRow(toExportRow(row));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  }

  // Eleicao (findEleicaoRows) nao tem paginacao por cursor ainda (T7 nao a implementou - volume
  // da categoria e' baixo, uma vez por eleicao). Mantido como esta' hoje; se o volume crescer,
  // paginar findEleicaoRows e' um follow-up separado, fora do escopo de T9.
  private async streamEleicaoRows(
    filter: Pick<BasePagamentoFilter, 'dataInicio' | 'dataFim' | 'statuses' | 'valorMin' | 'valorMax'>,
    onRow: (row: RelatorioFinancialMovementNovoRemessaData) => Promise<void> | void,
  ): Promise<void> {
    const rows = await this.basePagamentoRepository.findEleicaoRows(filter);
    for (const row of rows) await onRow(toExportRow(row));
  }

  // STUC-Gratuidade: StucGratuidadeRepository.findRows ja devolve a janela pivotada (ate 4
  // pares data/valor); explode cada dia em sua propria linha de export, igual ao legado
  // (streamFinancialMovementRows, relatorio-novo-remessa-financial-movement.service.ts) -
  // "dataReferencia"/"valor" passam a ser os do dia, "valorLancamento" preserva o total da
  // janela. O pivot novo (T8) nao expoe "dataPagamento" da janela diretamente (ver
  // stuc-gratuidade-pivot.ts) - recomputado aqui via resolveStucPaymentWindow (ja existente,
  // nao alterado), que devolve a mesma data de pagamento para qualquer dia da mesma janela.
  private async streamStucRows(
    filter: StucGratuidadeFilter,
    onRow: (row: RelatorioFinancialMovementNovoRemessaData) => Promise<void> | void,
  ): Promise<void> {
    const windows = await this.stucGratuidadeRepository.findRows(filter);
    for (const windowRow of windows) {
      const days: Array<[Date | null, number | null]> = [
        [windowRow.dataOrdemPagamento1, windowRow.valorOrdemPagamento1],
        [windowRow.dataOrdemPagamento2, windowRow.valorOrdemPagamento2],
        [windowRow.dataOrdemPagamento3, windowRow.valorOrdemPagamento3],
        [windowRow.dataOrdemPagamento4, windowRow.valorOrdemPagamento4],
      ];
      for (const [dataOrdem, valorOrdem] of days) {
        // Posicao fora do comprimento real da janela (ex.: a 4a de uma janela de 3 dias) fica
        // null nos dois campos - nunca existiu, diferente de um dia com valor 0 (pivotStucGratuidadeRows
        // ja preenche esse caso com a data real + valor 0, que deve aparecer no export).
        if (!dataOrdem && valorOrdem == null) continue;
        const dataPagamento = resolveStucPaymentWindow(dataOrdem as Date).dataPagamento;
        await onRow(
          new RelatorioFinancialMovementNovoRemessaData({
            nomes: windowRow.nomes,
            cpfCnpj: windowRow.cpfCnpj,
            dataReferencia: format(dataOrdem as Date, 'dd/MM/yyyy'),
            valor: Number(valorOrdem ?? 0),
            valorLancamento: Number(windowRow.valor),
            dataPagamento: format(dataPagamento, 'dd/MM/yyyy'),
          }),
        );
      }
    }
  }
}

// Adapter de borda (decisao de T9, documentada em T9-summary.md "Decisions Made"): traduz
// BasePagamentoRow (6 campos, T1-T8) para o formato que o writer compartilhado e as colunas
// existentes (BASE_COLUMNS) esperam, SEM mudar BASE_COLUMNS - ver cabecalho do arquivo.
// "dataPagamento"/"email"/"codBanco"/"nomeBanco" nao tem equivalente na query re-derivada
// (nunca fizeram join com usuario/banco por linha, so com o agrupamento) e ficam undefined
// (o writer ja trata campo ausente como celula vazia, mesmo comportamento de qualquer linha
// legada que omitisse um campo opcional do DTO). "descricaoErro" tambem fica undefined para a
// maioria dos status, EXCETO Estorno/Rejeitado: como BasePagamentoRow nao carrega
// "codigoErro" por linha, getDescricaoErro (chamado pelo construtor do DTO) cai no fallback
// generico "Motivo não informado pelo banco" para toda linha de erro - diferente do legado, que
// podia mostrar o motivo real do banco quando disponivel. Ver T9-summary.md "Follow-up
// Needed" - achado relatado, nao corrigido nesta task (exigiria expor motivoStatusRemessa em
// BasePagamentoRow, fora do escopo de T9).
function toExportRow(row: BasePagamentoRow): RelatorioFinancialMovementNovoRemessaData {
  return new RelatorioFinancialMovementNovoRemessaData({
    dataReferencia: format(new Date(row.dataReferencia), 'dd/MM/yyyy'),
    nomes: row.nomes,
    cpfCnpj: row.cpfCnpj,
    consorcio: row.nomeConsorcio ?? undefined,
    valor: Number(row.valor),
    status: row.status,
  });
}

// Mapeia o filtro novo (statuses: StatusPagamento[]) para os flags booleanos que
// buildSelectedStatusLabels (reaproveitada do writer legado, financial-movement-export.utils.ts)
// espera - usada no cabecalho do PDF ("Status observado"). Sem flag generica "erro" no filtro
// novo (StatusPagamento nao tem um valor "erro" agregado, so Estorno/Rejeitado separados), por
// isso o argumento "erro" nunca e' setado aqui - mesma observacao documentada no proprio
// financial-movement-export.utils.ts para o uso legado, que tambem distingue os dois.
export function buildStatusLabelsFromFilter(statuses?: StatusPagamento[]): string[] {
  const selected = new Set(statuses ?? []);
  return buildSelectedStatusLabels({
    pago: selected.has(StatusPagamento.PAGO),
    estorno: selected.has(StatusPagamento.ERRO_ESTORNO),
    rejeitado: selected.has(StatusPagamento.ERRO_REJEITADO),
    emProcessamento: selected.has(StatusPagamento.AGUARDANDO_PAGAMENTO),
    pendenciaPaga: selected.has(StatusPagamento.PENDENCIA_PAGA),
    pendentes: selected.has(StatusPagamento.PENDENTES),
    aPagar: selected.has(StatusPagamento.A_PAGAR),
  });
}

// Resumo de totais por bucket de status (RelatorioFinancialMovementNovoRemessaSummaryDto),
// somando "valor" das linhas de findGroupedRows por status - mesma agregacao que
// buildSummaryLines (financial-movement-export.utils.ts) espera para montar as linhas do
// resumo. Usada por quem compoe o cabeçalho/resumo da exportacao (ex.: futuro controller T10),
// nao pelo proprio writer (que nao recebe totais pre-calculados hoje, so acumula o total das
// linhas efetivamente exportadas - ver financial-movement-pdf.ts, FinancialMovementPdfWriter).
export function buildSummaryFromRows(rows: BasePagamentoRow[]): RelatorioFinancialMovementNovoRemessaSummaryDto {
  const totals = {
    valorPago: 0,
    valorRejeitado: 0,
    valorEstornado: 0,
    valorAguardandoPagamento: 0,
    valorAPagar: 0,
    valorPendente: 0,
    valorPendenciaPaga: 0,
  };
  let valorTotal = 0;
  let count = 0;

  for (const row of rows) {
    const valor = Number(row.valor);
    valorTotal += valor;
    count += 1;
    switch (row.status) {
      case StatusPagamento.PAGO:
        totals.valorPago += valor;
        break;
      case StatusPagamento.ERRO_REJEITADO:
        totals.valorRejeitado += valor;
        break;
      case StatusPagamento.ERRO_ESTORNO:
        totals.valorEstornado += valor;
        break;
      case StatusPagamento.AGUARDANDO_PAGAMENTO:
        totals.valorAguardandoPagamento += valor;
        break;
      case StatusPagamento.A_PAGAR:
        totals.valorAPagar += valor;
        break;
      case StatusPagamento.PENDENTES:
        totals.valorPendente += valor;
        break;
      case StatusPagamento.PENDENCIA_PAGA:
        totals.valorPendenciaPaga += valor;
        break;
      default:
        break;
    }
  }

  return new RelatorioFinancialMovementNovoRemessaSummaryDto({ count, valorTotal, ...totals });
}
