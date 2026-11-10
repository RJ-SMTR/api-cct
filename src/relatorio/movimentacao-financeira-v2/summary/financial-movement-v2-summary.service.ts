import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import {
  RelatorioFinancialMovementNovoRemessaData,
  RelatorioFinancialMovementNovoRemessaPageDto,
  RelatorioFinancialMovementNovoRemessaSummaryDto,
} from '../../dtos/relatorio-financial-and-movement.dto';
import { BasePagamentoFilter, BasePagamentoRepository, Perfil } from '../base/base-pagamento.repository';
import { StucGratuidadeRepository, StucGratuidadeRow } from '../stuc-gratuidade/stuc-gratuidade.repository';
import { buildSummaryFromRows, toExportRow } from '../export/financial-movement-v2-export.service';
import { resolveCursorFromQuery } from './financial-movement-v2-query.mapper';

// Filtro combinado para as rotas v2 de summary/page (T10): mesmas fontes de T1-T9
// (BasePagamentoRepository/StucGratuidadeRepository), mais os flags de roteamento
// (eleicao/stucGratuidade, exclusivos entre si - ver resolveSource abaixo) e paginacao.
export type FinancialMovementV2Filter = BasePagamentoFilter & {
  eleicao?: boolean;
  stucGratuidade?: boolean;
  page?: number;
  pageSize?: number;
  cursorDataReferencia?: string;
  cursorNome?: string;
  cursorStatus?: string;
  cursorCpfCnpj?: string;
  cursorNomeConsorcio?: string;
  cursorValor?: string;
};

const DEFAULT_PAGE_SIZE = 50;

// Decisao de design de T10 (nao coberta por nenhuma task anterior): nenhuma delas construiu um
// servico unico de "summary"/"page" combinando as 3 fontes de Permissionario (base/Eleicao/
// STUC-Gratuidade). A exclusividade mutua entre elas replica a mesma logica de branching que
// RelatorioNovoRemessaFinancialMovementService.buildFinalBaseQuery/findFinancialMovementSummary
// ja usa no legado: stucGratuidade tem prioridade sobre eleicao (igual
// FinancialMovementV2ExportService.streamExportRows, T9), e so' entao cai no fluxo "base"
// (findGroupedRows/findGroupedRowsPage, T1-T6). Guardador nunca tem Eleicao/STUC (nao existe
// esse conceito nesse perfil, T7/T8) - os dois flags sao ignorados para ele.
@Injectable()
export class FinancialMovementV2SummaryService {
  constructor(
    private readonly basePagamentoRepository: BasePagamentoRepository,
    private readonly stucGratuidadeRepository: StucGratuidadeRepository,
  ) {}

  async findSummary(perfil: Perfil, filter: FinancialMovementV2Filter): Promise<RelatorioFinancialMovementNovoRemessaSummaryDto> {
    if (perfil === 'permissionario' && filter.stucGratuidade) {
      const rows = await this.stucGratuidadeRepository.findRows(filter);
      return buildStucGratuidadeSummary(rows);
    }
    if (perfil === 'permissionario' && filter.eleicao) {
      const rows = await this.basePagamentoRepository.findEleicaoRows(filter);
      return buildSummaryFromRows(rows);
    }
    const rows = await this.basePagamentoRepository.findGroupedRows(perfil, filter);
    return buildSummaryFromRows(rows);
  }

  async findPage(perfil: Perfil, filter: FinancialMovementV2Filter): Promise<RelatorioFinancialMovementNovoRemessaPageDto> {
    const { currentPage, pageSize } = resolvePagination(filter);

    // Eleicao (findEleicaoRows, T7) e STUC-Gratuidade (StucGratuidadeRepository.findRows, T8)
    // nao tem paginacao por cursor - T7/T9 nunca construiram uma (volume baixo, ver
    // T7/T9-summary.md "Follow-up Needed"). Decisao desta task: paginar em memoria apos carregar
    // tudo (slice por page/pageSize), a mesma estrategia que o STUC-Gratuidade legado ja usa
    // (findStucGratuidadePage, relatorio-novo-remessa-financial-movement.service.ts) - nao um
    // sistema de cursor novo (fora de escopo, ver T10 "Desired Behavior"). Aceitavel enquanto o
        // volume de cada fonte for pequeno (uma eleicao por vez, gratuidade mensal); se crescer,
    // vira follow-up separado, assim como ja esta' registrado para o export (T9).
    if (perfil === 'permissionario' && filter.stucGratuidade) {
      const rows = await this.stucGratuidadeRepository.findRows(filter);
      return buildInMemoryPage(rows, currentPage, pageSize, buildStucGratuidadeSummary(rows), toStucResponseRow);
    }
    if (perfil === 'permissionario' && filter.eleicao) {
      const rows = await this.basePagamentoRepository.findEleicaoRows(filter);
      return buildInMemoryPage(rows, currentPage, pageSize, buildSummaryFromRows(rows), toExportRow);
    }

    const cursor = resolveCursorFromQuery(filter);
    const [page, summary] = await Promise.all([
      this.basePagamentoRepository.findGroupedRowsPage(perfil, filter, pageSize, cursor),
      this.findSummary(perfil, filter),
    ]);
    return new RelatorioFinancialMovementNovoRemessaPageDto({
      ...summary,
      currentPage,
      pageSize,
      data: page.rows.map(toExportRow),
      // BasePagamentoCursor (T4/ADR 0002) is the v2 cursor shape - genuinely different from the
      // legacy RelatorioFinancialMovementNovoRemessaCursor (see financial-movement-v2-query.mapper.ts
      // header comment on the field mismatch). Not opaque to the frontend by design (ADR 0021
      // decision 6), so it is returned as-is rather than reshaped to fit the legacy type.
      nextCursor: page.nextCursor as unknown as RelatorioFinancialMovementNovoRemessaPageDto['nextCursor'],
    });
  }
}

function resolvePagination(filter: FinancialMovementV2Filter): { currentPage: number; pageSize: number } {
  const cp = Number(filter.page);
  const ps = Number(filter.pageSize);
  return {
    currentPage: Number.isInteger(cp) && cp > 0 ? cp : 1,
    pageSize: Number.isInteger(ps) && ps > 0 ? ps : DEFAULT_PAGE_SIZE,
  };
}

function buildInMemoryPage<T>(
  rows: T[],
  currentPage: number,
  pageSize: number,
  summary: RelatorioFinancialMovementNovoRemessaSummaryDto,
  toRow: (row: T) => RelatorioFinancialMovementNovoRemessaData,
): RelatorioFinancialMovementNovoRemessaPageDto {
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const hasNext = start + pageSize < rows.length;
  return new RelatorioFinancialMovementNovoRemessaPageDto({
    ...summary,
    currentPage,
    pageSize,
    data: pageRows.map(toRow),
    nextCursor: hasNext ? String(currentPage + 1) : null,
  });
}

// Mesma agregacao por status que buildStucGratuidadeSummary faz no legado
// (relatorio-novo-remessa-financial-movement.service.ts) - StucGratuidadeRow.valor ja' e'
// number (StucGratuidadeRepository.findRows, T8), diferente de BasePagamentoRow.valor (string),
// por isso nao reusa buildSummaryFromRows (que espera string). Nunca tem status 'Pendentes'
// (STUC-Gratuidade nao inclui essa fonte, T8) - valorPendente sempre 0, igual ao legado.
function buildStucGratuidadeSummary(rows: StucGratuidadeRow[]): RelatorioFinancialMovementNovoRemessaSummaryDto {
  const sumByStatus = (status: StatusPagamento) => rows.filter((r) => r.status === status).reduce((acc, r) => acc + (r.valor ?? 0), 0);
  return new RelatorioFinancialMovementNovoRemessaSummaryDto({
    count: rows.length,
    valorTotal: rows.reduce((acc, r) => acc + (r.valor ?? 0), 0),
    valorPago: sumByStatus(StatusPagamento.PAGO),
    valorEstornado: sumByStatus(StatusPagamento.ERRO_ESTORNO),
    valorRejeitado: sumByStatus(StatusPagamento.ERRO_REJEITADO),
    valorAguardandoPagamento: sumByStatus(StatusPagamento.AGUARDANDO_PAGAMENTO),
    valorAPagar: sumByStatus(StatusPagamento.A_PAGAR),
    valorPendente: 0,
    valorPendenciaPaga: sumByStatus(StatusPagamento.PENDENCIA_PAGA),
  });
}

// Linha de resposta para STUC-Gratuidade na pagina (ja pivotada em janela, T8) - igual ao
// legado (findStucGratuidadePage), sem explodir por dia (isso so acontece no export, T9).
function toStucResponseRow(row: StucGratuidadeRow): RelatorioFinancialMovementNovoRemessaData {
  return new RelatorioFinancialMovementNovoRemessaData({
    nomes: row.nomes,
    cpfCnpj: row.cpfCnpj,
    consorcio: row.nomeConsorcio ?? undefined,
    status: row.status,
    valor: row.valor,
    dataOrdemPagamento1: row.dataOrdemPagamento1 ? format(row.dataOrdemPagamento1, 'dd/MM/yyyy') : null,
    valorOrdemPagamento1: row.valorOrdemPagamento1,
    dataOrdemPagamento2: row.dataOrdemPagamento2 ? format(row.dataOrdemPagamento2, 'dd/MM/yyyy') : null,
    valorOrdemPagamento2: row.valorOrdemPagamento2,
    dataOrdemPagamento3: row.dataOrdemPagamento3 ? format(row.dataOrdemPagamento3, 'dd/MM/yyyy') : null,
    valorOrdemPagamento3: row.valorOrdemPagamento3,
    dataOrdemPagamento4: row.dataOrdemPagamento4 ? format(row.dataOrdemPagamento4, 'dd/MM/yyyy') : null,
    valorOrdemPagamento4: row.valorOrdemPagamento4,
  });
}
