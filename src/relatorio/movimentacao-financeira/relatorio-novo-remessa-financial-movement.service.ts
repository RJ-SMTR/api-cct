import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import { format, parse } from 'date-fns';
import { CustomLogger } from 'src/utils/custom-logger';
import { pivotStucGratuidadeRows } from '../utils/stuc-gratuidade-pivot';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import {
  buildBaseQuery,
  buildEleicaoQuery,
  buildPendentesQuery,
  buildPendenciaPagamentoSingleDateQuery,
  buildPendenciaPagaSingleDateQuery,
  buildStucGratuidadeQuery,
  buildStucGratuidadePendenciaPagaSingleDateQuery,
  buildStucGratuidadePendenciaPagamentoSingleDateQuery,
} from '../novo-remessa/queries/novo-remessa-query-builder';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import {
  RelatorioFinancialMovementNovoRemessaData,
  RelatorioFinancialMovementNovoRemessaPageDto,
  RelatorioFinancialMovementNovoRemessaSummaryDto,
} from '../dtos/relatorio-financial-and-movement.dto';

import { RelatorioGuardadorFinancialMovementRepository } from './relatorio-guardador-financial-movement.repository';
import { writeFinancialMovementExport, FinancialMovementExportFormatValue } from '../utils/financial-movement-export-writer';
import { buildSelectedStatusLabels } from './financial-movement-export.utils';

type NormalizedFilter = IFindPublicacaoRelatorioNovoFinancialMovement & {
  dataInicio: Date;
  dataFim: Date;
  page?: number;
  pageSize?: number;
};

type ResolvedStatuses = {
  baseStatuses: string[] | null;
  includePendentes: boolean;
  includeBase: boolean;
  includePendenciaPaga: boolean;
  parentErrorStatusesSingleDate: Array<StatusPagamento.ERRO_ESTORNO | StatusPagamento.ERRO_REJEITADO>;
};

type CursorValues = {
  dataReferencia: string | null;
  nome: string | null;
  status: string | null;
  cpfCnpj: string | null;
  // Tie-breakers: "grouped" aggregates by more columns than the 4 above, so two grouped
  // rows can share the same (dataReferencia, nomes, status, cpfCnpj) tuple (e.g. the same
  // favorecido paid under two different consórcios on the same date/status). Without these,
  // a page boundary landing inside such a tie silently drops the remaining rows.
  nomeConsorcio: string | null;
  codBanco: string | null;
  dataPagamento: string | null;
  email: string | null;
};

// Tuple columns shared by the ORDER BY and the keyset WHERE comparison. COALESCE avoids
// Postgres row-comparison returning NULL (and silently excluding the row) whenever a
// tie-breaker column is NULL.
const CURSOR_TUPLE_COLUMNS = `
  g."dataReferencia",
  g.nomes,
  g.status,
  g."cpfCnpj",
  COALESCE(g."nomeConsorcio", ''),
  COALESCE(g."codBanco"::text, ''),
  COALESCE(to_char(g."dataPagamento", 'YYYY-MM-DD"T"HH24:MI:SS'), ''),
  COALESCE(g.email, '')
`;

@Injectable()
export class RelatorioNovoRemessaFinancialMovementService {
  private readonly logger = new CustomLogger(RelatorioNovoRemessaFinancialMovementService.name, { timestamp: true });

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly relatorioGuardadorFinancialMovementRepository: RelatorioGuardadorFinancialMovementRepository,
  ) {}

  public async findGuardadorFinancialMovementSummary(filter: IFindPublicacaoRelatorioNovoFinancialMovement) {
    return this.relatorioGuardadorFinancialMovementRepository.findFinancialMovementSummary(filter);
  }

  public async findGuardadorFinancialMovementPage(filter: IFindPublicacaoRelatorioNovoFinancialMovement) {
    return this.relatorioGuardadorFinancialMovementRepository.findFinancialMovementPage(filter);
  }

  public async downloadGuardadorFinancialMovementExport(
    filter: IFindPublicacaoRelatorioNovoFinancialMovement & { format?: FinancialMovementExportFormatValue },
  ) {
    return writeFinancialMovementExport(
      filter.format ?? 'csv',
      'financial-movement-guardadores',
      (onRow) => this.relatorioGuardadorFinancialMovementRepository.streamFinancialMovementRows(filter, onRow),
      { dataInicio: new Date(filter.dataInicio), dataFim: new Date(filter.dataFim), statusLabels: buildSelectedStatusLabels(filter) },
    );
  }

  public async findFinancialMovementSummary(filter: IFindPublicacaoRelatorioNovoFinancialMovement) {
    const safeFilter = this.normalizeFilter(filter);
    // A agregação em SQL abaixo soma por dia (grouped.valor), não pela janela de pagamento
    // pivotada - incompatível com STUC - Gratuidade, que agrega e filtra por Valor Lançamento
    // (ver findStucGratuidadePivotedRows). Ver stuc-gratuidade-pivot.ts.
    if (safeFilter.stucGratuidade) {
      const pivotedRows = await this.findStucGratuidadePivotedRows(safeFilter);
      return this.buildStucGratuidadeSummary(pivotedRows);
    }
    const statuses = this.resolveStatuses(safeFilter);
    const innerParams = this.getInnerQueryParameters(safeFilter, statuses.baseStatuses);
    const finalBaseQuery = this.buildFinalBaseQuery(safeFilter, statuses);
    const { countQuery, aggregatesQuery } = this.buildSummaryQueries(finalBaseQuery);
    const outerParams = [safeFilter.valorMin?? null, safeFilter.valorMax?? null];
    const params = [...innerParams,...outerParams];
    const [countRows, aggregateRows] = await Promise.all([
      this.executeQuery(countQuery, params, 'COUNT'),
      this.executeQuery(aggregatesQuery, params, 'SUM'),
    ]);
    const totalCount = Number(countRows?.[0]?.count?? 0);
    const aggregates = aggregateRows?.[0]?? {};
    return new RelatorioFinancialMovementNovoRemessaSummaryDto({
      count: totalCount,
      valorTotal: Number.parseFloat((aggregates.valorTotal?? 0).toString()),
      valorPago: Number(aggregates.valorPago?? 0),
      valorEstornado: Number(aggregates.valorEstornado?? 0),
      valorRejeitado: Number(aggregates.valorRejeitado?? 0),
      valorAguardandoPagamento: Number(aggregates.valorAguardandoPagamento?? 0),
      valorAPagar: Number(aggregates.valorAPagar?? 0),
      valorPendente: Number(aggregates.valorPendente?? 0),
      valorPendenciaPaga: Number(aggregates.valorPendenciaPaga?? 0),
    });
  }

  public async findFinancialMovementPage(filter: IFindPublicacaoRelatorioNovoFinancialMovement) {
    const safeFilter = this.normalizeFilter(filter);
    if (safeFilter.stucGratuidade) return this.findStucGratuidadePage(safeFilter);
    const { query, params } = this.buildBaseDataQuery(safeFilter);
    const { currentPage, pageSize } = this.resolvePagination(safeFilter);
    const cursor = this.resolveCursor(safeFilter);
    const dataQuery = `
      ${query}
      AND (
        $8::text IS NULL
        OR (${CURSOR_TUPLE_COLUMNS}) > (
          to_date($8, 'DD/MM/YYYY'), $9::text, $10::text, $11::text,
          COALESCE($13::text, ''), COALESCE($14::text, ''), COALESCE($15::text, ''), COALESCE($16::text, '')
        )
      )
      ORDER BY ${CURSOR_TUPLE_COLUMNS}
      LIMIT $12
    `;
    const dataParams = [
      ...params,
      cursor.dataReferencia,
      cursor.nome,
      cursor.status,
      cursor.cpfCnpj,
      pageSize,
      cursor.nomeConsorcio,
      cursor.codBanco,
      cursor.dataPagamento,
      cursor.email,
    ];
    const [rows, summary] = await Promise.all([
      this.executeQuery(dataQuery, dataParams, 'PAGE'),
      this.findFinancialMovementSummary(safeFilter),
    ]);
    const data = rows.map((row) => new RelatorioFinancialMovementNovoRemessaData(row));
    const lastRow = rows?.[rows.length - 1];
    const nextCursor = lastRow
      ? {
          dataReferencia: lastRow.dataReferencia,
          nomes: lastRow.nomes,
          status: lastRow.status,
          cpfCnpj: lastRow.cpfCnpj,
          nomeConsorcio: lastRow.consorcio,
          codBanco: lastRow.codBanco,
          dataPagamento: lastRow.dataPagamentoCursor,
          email: lastRow.email,
        }
      : null;
    return new RelatorioFinancialMovementNovoRemessaPageDto({
      ...summary,
      currentPage,
      pageSize,
      data,
      nextCursor,
    });
  }

  public async streamFinancialMovementRows(filter: IFindPublicacaoRelatorioNovoFinancialMovement, onRow: (row: RelatorioFinancialMovementNovoRemessaData) => Promise<void> | void) {
    const safeFilter = this.normalizeFilter(filter);
    if (safeFilter.stucGratuidade) {
      // A Movimentação Financeira não ganha colunas extras "Ord. de Pag. N" (ADR 0012, exclusivo
      // do Consolidado), mas cada dia da janela ainda precisa virar sua própria linha no export -
      // igual já acontece na tela (StucGratuidadeTable.js, explodeStucGratuidadeRows) e no export
      // do Consolidado. "Data Referência"/"Valor" passam a ser os do dia; "Data Pagamento" continua
      // sendo o da janela (repetido a cada linha). "valorLancamento" preserva o total da janela
      // (windowRow.valor, perdido ao sobrescrever "valor" abaixo com o valor do dia) - o export
      // STUC (financial-movement-export-writer.ts) usa os dois, igual à tela.
      const windows = await this.findStucGratuidadePivotedRows(safeFilter);
      for (const windowRow of windows) {
        for (const n of [1, 2, 3, 4] as const) {
          const dataOrdem = (windowRow as any)[`dataOrdemPagamento${n}`];
          const valorOrdem = (windowRow as any)[`valorOrdemPagamento${n}`];
          if (!dataOrdem && valorOrdem == null) continue;
          // Spread puro (sem passar de novo pelo construtor): windowRow já é uma instância com
          // "descricaoErro" calculado a partir de codigoErro (que não sobrevive na instância) -
          // reconstruir via `new RelatorioFinancialMovementNovoRemessaData({...})` recalcularia
          // sem o código original e trocaria a descrição real por "Motivo não informado".
          await onRow({ ...windowRow, dataReferencia: dataOrdem, valor: valorOrdem, valorLancamento: windowRow.valor });
        }
      }
      return;
    }
    let cursor: CursorValues = {
      dataReferencia: null,
      nome: null,
      status: null,
      cpfCnpj: null,
      nomeConsorcio: null,
      codBanco: null,
      dataPagamento: null,
      email: null,
    };
    const batchSize = 500;
    while (true) {
      const rows = await this.findFinancialMovementBatchRows(safeFilter, cursor, batchSize, 'EXPORT');
      if (!rows.length) break;
      for (const row of rows) await onRow(new RelatorioFinancialMovementNovoRemessaData(row));
      const lastRow = rows[rows.length - 1];
      cursor = {
        dataReferencia: lastRow.dataReferencia,
        nome: lastRow.nomes,
        status: lastRow.status,
        cpfCnpj: lastRow.cpfCnpj,
        nomeConsorcio: lastRow.consorcio,
        codBanco: lastRow.codBanco,
        dataPagamento: lastRow.dataPagamentoCursor,
        email: lastRow.email,
      };
      if (rows.length < batchSize) break;
    }
  }

  public async downloadFinancialMovementExport(
    filter: IFindPublicacaoRelatorioNovoFinancialMovement & { format?: FinancialMovementExportFormatValue },
  ) {
    // O DTO do controller aceita csv/xlsx/pdf (FinancialMovementExportFormat), mas até aqui só
    // csv era gerado de fato - os outros dois formatos vinham com conteúdo CSV e extensão errada.
    return writeFinancialMovementExport(
      filter.format ?? 'csv',
      'financial-movement',
      (onRow) => this.streamFinancialMovementRows(filter, onRow),
      { dataInicio: new Date(filter.dataInicio), dataFim: new Date(filter.dataFim), statusLabels: buildSelectedStatusLabels(filter) },
      Boolean(filter.stucGratuidade),
    );
  }

  public async removeGeneratedExportFile(filePath: string) {
    try { if (fs.existsSync(filePath)) await fs.promises.unlink(filePath); } catch {}
  }

  private buildBaseCte(finalBaseQuery: string) { return `WITH base AS ( ${finalBaseQuery} )`; }
  private buildGroupedCte(finalBaseQuery: string) {
    return `${this.buildBaseCte(finalBaseQuery)}, grouped AS (SELECT "dataReferencia", nomes, email, "codBanco", "nomeBanco", "cpfCnpj", "nomeConsorcio", status, "dataPagamento", "codigoErro", SUM(valor) AS valor FROM base GROUP BY "dataReferencia", nomes, email, "codBanco", "nomeBanco", "cpfCnpj", "nomeConsorcio", status, "dataPagamento", "codigoErro")`;
  }

  private buildSummaryQueries(finalBaseQuery: string) {
    const groupedCte = this.buildGroupedCte(finalBaseQuery);
    return {
      countQuery: `${groupedCte} SELECT COUNT(*)::int AS count FROM grouped WHERE 1=1 AND ($6::numeric IS NULL OR grouped.valor >= $6::numeric) AND ($7::numeric IS NULL OR grouped.valor <= $7::numeric)`,
      aggregatesQuery: `${groupedCte} SELECT COALESCE(SUM(valor),0) AS "valorTotal", COALESCE(SUM(CASE WHEN status='Pago' THEN valor ELSE 0 END),0) AS "valorPago", COALESCE(SUM(CASE WHEN status='Estorno' THEN valor ELSE 0 END),0) AS "valorEstornado", COALESCE(SUM(CASE WHEN status='Rejeitado' THEN valor ELSE 0 END),0) AS "valorRejeitado", COALESCE(SUM(CASE WHEN status='Aguardando Pagamento' THEN valor ELSE 0 END),0) AS "valorAguardandoPagamento", COALESCE(SUM(CASE WHEN status='A Pagar' THEN valor ELSE 0 END),0) AS "valorAPagar", COALESCE(SUM(CASE WHEN status='Pendentes' THEN valor ELSE 0 END),0) AS "valorPendente", COALESCE(SUM(CASE WHEN status='Pendencia Paga' THEN valor ELSE 0 END),0) AS "valorPendenciaPaga" FROM grouped WHERE 1=1 AND ($6::numeric IS NULL OR grouped.valor >= $6::numeric) AND ($7::numeric IS NULL OR grouped.valor <= $7::numeric)`,
    };
  }

  private buildBaseDataQuery(filter: NormalizedFilter) {
    const statuses = this.resolveStatuses(filter);
    const innerParams = this.getInnerQueryParameters(filter, statuses.baseStatuses);
    const params = [...innerParams, filter.valorMin?? null, filter.valorMax?? null];
    const finalBaseQuery = this.buildFinalBaseQuery(filter, statuses);
    const groupedCte = this.buildGroupedCte(finalBaseQuery);
    // STUC - Gratuidade usa DATE(op."dataOrdem") como dataReferencia (ver AGRUPAMENTO_GRATUIDADE
    // em novo-remessa-query-builder.ts) - uma coluna "date" pura, sem hora nem timezone. Girar
    // essa meia-noite por AT TIME ZONE 'America/Sao_Paulo' a empurra para o dia anterior (achado
    // testando contra produção: favorecido ABDON ALVIM DE QUEIROZ, janela 13-15/10/2026 aparecia
    // como 12-14/10 só na Movimentação Financeira - o Consolidado, que não faz essa conversão,
    // mostrava a data correta). O fluxo normal usa detalhe_a."dataVencimento" (um TIMESTAMP real),
    // onde a conversão de fato se aplica.
    const dataReferenciaSelect = filter.stucGratuidade
      ? `to_char(g."dataReferencia",'DD/MM/YYYY') AS "dataReferencia"`
      : `to_char(g."dataReferencia" AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY') AS "dataReferencia"`;
    return {
      params,
      query: `${groupedCte} SELECT ${dataReferenciaSelect}, to_char(g."dataPagamento" AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY') AS "dataPagamento", g.nomes, g.email, g."codBanco", g."nomeBanco", g."cpfCnpj", g."nomeConsorcio" AS consorcio, g.valor, g.status, g."codigoErro", to_char(g."dataPagamento", 'YYYY-MM-DD"T"HH24:MI:SS') AS "dataPagamentoCursor" FROM grouped g WHERE 1=1 AND ($6::numeric IS NULL OR g.valor >= $6::numeric) AND ($7::numeric IS NULL OR g.valor <= $7::numeric)`,
    };
  }

  // STUC - Gratuidade (ADR 0012): cada linha deixa de ser "um dia" e passa a ser "uma janela
  // de pagamento" (até 4 dias). O pivot muda a cardinalidade das linhas, então precisa rodar
  // sobre o conjunto completo do filtro antes de qualquer corte de página - paginação por
  // cursor/LIMIT em SQL não se aplica a este branch.
  private async findStucGratuidadePivotedRows(filter: NormalizedFilter): Promise<RelatorioFinancialMovementNovoRemessaData[]> {
    // valorMin/valorMax se referem ao Valor Lançamento (a janela de pagamento já pivotada,
    // até 4 dias somados), não ao valor de um dia isolado. Busca sem filtro de valor em SQL
    // (senão um dia abaixo do mínimo sumiria mesmo com a janela toda acima dele) e filtra
    // depois do pivot - mesma abordagem do Consolidado (findConsolidadoStucGratuidade).
    const { query, params } = this.buildBaseDataQuery({ ...filter, valorMin: undefined, valorMax: undefined });
    const dayRows = await this.executeQuery(query, params, 'STUC_PIVOT');
    const groupKeyFn = (row: any) =>
      [row.nomes, row.email, row.codBanco, row.nomeBanco, row.cpfCnpj, row.consorcio, row.status, row.codigoErro].join('::');
    let pivoted = pivotStucGratuidadeRows(
      dayRows.map((row: any) => ({ ...row, dataReferencia: parse(row.dataReferencia, 'dd/MM/yyyy', new Date()) })),
      groupKeyFn,
    );
    const { valorMin, valorMax } = filter;
    if (valorMin !== undefined && valorMax !== undefined) {
      pivoted = pivoted.filter((row) => row.valor >= valorMin && row.valor <= valorMax);
    } else if (valorMin !== undefined) {
      pivoted = pivoted.filter((row) => row.valor >= valorMin);
    } else if (valorMax !== undefined) {
      pivoted = pivoted.filter((row) => row.valor <= valorMax);
    }
    pivoted = [...pivoted].sort((a: any, b: any) => {
      const porNome = String(a.nomes ?? '').localeCompare(String(b.nomes ?? ''));
      if (porNome !== 0) return porNome;
      return String(a.dataPagamentoCursor ?? '').localeCompare(String(b.dataPagamentoCursor ?? ''));
    });
    return pivoted.map(
      (row) =>
        new RelatorioFinancialMovementNovoRemessaData({
          ...row,
          dataOrdemPagamento1: row.dataOrdemPagamento1 ? format(row.dataOrdemPagamento1, 'dd/MM/yyyy') : null,
          dataOrdemPagamento2: row.dataOrdemPagamento2 ? format(row.dataOrdemPagamento2, 'dd/MM/yyyy') : null,
          dataOrdemPagamento3: row.dataOrdemPagamento3 ? format(row.dataOrdemPagamento3, 'dd/MM/yyyy') : null,
          dataOrdemPagamento4: row.dataOrdemPagamento4 ? format(row.dataOrdemPagamento4, 'dd/MM/yyyy') : null,
        } as any),
    );
  }

  // Soma por status a partir das linhas já pivotadas (e já filtradas por valorMin/valorMax,
  // se houver) - evita repetir em SQL uma agregação que só faz sentido por Valor Lançamento.
  // STUC - Gratuidade nunca inclui buildPendentesQuery (ver buildFinalBaseQuery), então não
  // há status 'Pendentes' aqui.
  private buildStucGratuidadeSummary(rows: RelatorioFinancialMovementNovoRemessaData[]): RelatorioFinancialMovementNovoRemessaSummaryDto {
    const sumByStatus = (status: string) =>
      rows.filter((r) => r.status === status).reduce((acc, r) => acc + (r.valor ?? 0), 0);
    return new RelatorioFinancialMovementNovoRemessaSummaryDto({
      count: rows.length,
      valorTotal: rows.reduce((acc, r) => acc + (r.valor ?? 0), 0),
      valorPago: sumByStatus('Pago'),
      valorEstornado: sumByStatus('Estorno'),
      valorRejeitado: sumByStatus('Rejeitado'),
      valorAguardandoPagamento: sumByStatus('Aguardando Pagamento'),
      valorAPagar: sumByStatus('A Pagar'),
      valorPendente: 0,
      valorPendenciaPaga: sumByStatus('Pendencia Paga'),
    });
  }

  private async findStucGratuidadePage(filter: NormalizedFilter) {
    const { currentPage, pageSize } = this.resolvePagination(filter);
    const pivotedRows = await this.findStucGratuidadePivotedRows(filter);
    const summary = this.buildStucGratuidadeSummary(pivotedRows);
    const start = (currentPage - 1) * pageSize;
    const data = pivotedRows.slice(start, start + pageSize);
    return new RelatorioFinancialMovementNovoRemessaPageDto({
      ...summary,
      currentPage,
      pageSize,
      data,
      nextCursor: null,
    });
  }

  private async findFinancialMovementBatchRows(filter: NormalizedFilter, cursor: CursorValues, limit: number, label: string) {
    const { query, params } = this.buildBaseDataQuery(filter);
    const dataQuery = `
      ${query}
      AND (
        $8::text IS NULL
        OR (${CURSOR_TUPLE_COLUMNS}) > (
          to_date($8, 'DD/MM/YYYY'), $9::text, $10::text, $11::text,
          COALESCE($13::text, ''), COALESCE($14::text, ''), COALESCE($15::text, ''), COALESCE($16::text, '')
        )
      )
      ORDER BY ${CURSOR_TUPLE_COLUMNS}
      LIMIT $12
    `;
    return this.executeQuery(dataQuery, [
      ...params,
      cursor.dataReferencia,
      cursor.nome,
      cursor.status,
      cursor.cpfCnpj,
      limit,
      cursor.nomeConsorcio,
      cursor.codBanco,
      cursor.dataPagamento,
      cursor.email,
    ], label);
  }

  private normalizeFilter(filter: IFindPublicacaoRelatorioNovoFinancialMovement): NormalizedFilter {
    return {...filter, dataInicio: new Date(filter.dataInicio), dataFim: new Date(filter.dataFim), page: filter.page? Number(filter.page) : undefined, pageSize: filter.pageSize? Number(filter.pageSize) : undefined };
  }

  private resolveStatuses(filter: NormalizedFilter): ResolvedStatuses {
    const all = this.getStatusParaFiltro(filter);
    if (!all?.length) return { baseStatuses: null, includePendentes: false, includeBase: true, includePendenciaPaga: false, parentErrorStatusesSingleDate: [] };
    const isSingle = this.isSingleDate(filter);
    const includePendentes = all.includes(StatusPagamento.PENDENTES);
    // Pendencia Paga é consultada pela data de pagamento em qualquer intervalo (ADR 0001), não só em dia único.
    const includePendenciaPaga = all.includes(StatusPagamento.PENDENCIA_PAGA);
    const parentErrorStatusesSingleDate = isSingle
      ? all.filter((status): status is StatusPagamento.ERRO_ESTORNO | StatusPagamento.ERRO_REJEITADO => status === StatusPagamento.ERRO_ESTORNO || status === StatusPagamento.ERRO_REJEITADO)
      : [];
    let baseStatuses = all.filter((s) => s!== StatusPagamento.PENDENTES);
    // Pendencia Paga nunca pertence à base por vencimento (ela é identificada pela data de pagamento).
    baseStatuses = baseStatuses.filter((s) => s!== StatusPagamento.PENDENCIA_PAGA);
    baseStatuses = baseStatuses.filter((s) => !parentErrorStatusesSingleDate.includes(s as StatusPagamento.ERRO_ESTORNO | StatusPagamento.ERRO_REJEITADO));
    return { baseStatuses: baseStatuses.length? baseStatuses : null, includePendentes, includeBase: baseStatuses.length > 0, includePendenciaPaga, parentErrorStatusesSingleDate };
  }

  private buildFinalBaseQuery(filter: NormalizedFilter, statuses: ResolvedStatuses): string {
    const raw = (() => {
      // STUC - Gratuidade lê de uma fonte diferente (valorGratuidade / agrupamento de
      // gratuidade), mutuamente exclusiva com Eleição/Desativados/Pendentes na UI. Nunca
      // inclui buildPendentesQuery: "OPs atrasadas" não existe para esse fluxo.
      if (filter.stucGratuidade) {
        const q: string[] = [];
        if (statuses.includeBase) q.push(this.buildStucGratuidadeQuery(filter));
        if (statuses.includePendenciaPaga) q.push(this.buildStucGratuidadePendenciaPagaSingleDateQuery(filter));
        if (statuses.parentErrorStatusesSingleDate.length) q.push(this.buildStucGratuidadePendenciaPagamentoSingleDateQuery(filter, statuses.parentErrorStatusesSingleDate));
        if (!q.length) return `${this.buildStucGratuidadeQuery(filter)} AND FALSE`;
        return q.join('\nUNION ALL\n');
      }
      if (filter.eleicao &&!this.hasOtherStatusFilters(filter)) return this.buildEleicaoQuery(filter);
      const q: string[] = [];
      if (filter.eleicao) q.push(this.buildEleicaoQuery(filter));
      if (statuses.includeBase) q.push(this.buildBaseQuery(filter));
      if (statuses.includePendenciaPaga) q.push(this.buildPendenciaPagaSingleDateQuery(filter));
      if (statuses.parentErrorStatusesSingleDate.length) q.push(this.buildPendenciaPagamentoSingleDateQuery(filter, statuses.parentErrorStatusesSingleDate));
      if (statuses.includePendentes) q.push(this.buildPendentesQuery(filter));
      // Nenhuma consulta selecionada para o filtro: não deve trazer linhas (antes caía em todos os status).
      if (!q.length) return `${this.buildBaseQuery(filter)} AND FALSE`;
      return q.join('\nUNION ALL\n');
    })();
    // REMOVE $6 e $7 internos -> substitui por literais tipados que não filtram
    return raw
     .replace(/\$6::numeric/g, '-9999999999.99::numeric')
     .replace(/\$7::numeric/g, '9999999999.99::numeric')
     .replace(/\$6(?!\d)/g, '-9999999999.99::numeric')
     .replace(/\$7(?!\d)/g, '9999999999.99::numeric');
  }

  private buildBaseQuery(filter: NormalizedFilter): string {
    return `${buildBaseQuery({ todosVanzeiros: filter.todosVanzeiros, consorcioFilterParamIndex: 5 }).trim()} ${filter.desativados? 'AND pu.bloqueado = true' : ''}`;
  }
  private buildEleicaoQuery(filter: NormalizedFilter): string {
    return `${buildEleicaoQuery({ todosVanzeiros: filter.todosVanzeiros, consorcioFilterParamIndex: 5 }).trim()} ${filter.desativados? 'AND pu.bloqueado = true' : ''}`;
  }
  private buildStucGratuidadeQuery(filter: NormalizedFilter): string {
    return `${buildStucGratuidadeQuery({ todosVanzeiros: filter.todosVanzeiros, consorcioFilterParamIndex: 5 }).trim()} ${filter.desativados? 'AND pu.bloqueado = true' : ''}`;
  }
  private buildStucGratuidadePendenciaPagaSingleDateQuery(filter: NormalizedFilter): string {
    return `${buildStucGratuidadePendenciaPagaSingleDateQuery({ todosVanzeiros: filter.todosVanzeiros, consorcioFilterParamIndex: 5 }).trim()} ${filter.desativados? 'AND pu.bloqueado = true' : ''}`;
  }
  private buildStucGratuidadePendenciaPagamentoSingleDateQuery(filter: NormalizedFilter, statuses: Array<StatusPagamento.ERRO_ESTORNO | StatusPagamento.ERRO_REJEITADO>): string {
    return `${buildStucGratuidadePendenciaPagamentoSingleDateQuery({ todosVanzeiros: filter.todosVanzeiros, consorcioFilterParamIndex: 5, parentErrorStatuses: statuses }).trim()} ${filter.desativados ? 'AND pu.bloqueado = true' : ''}`;
  }
  private buildPendentesQuery(filter: NormalizedFilter): string {
    return `${buildPendentesQuery({ todosVanzeiros: filter.todosVanzeiros, consorcioFilterParamIndex: 5 } as any).trim()} ${filter.desativados? 'AND pu.bloqueado = true' : ''}`;
  }
  private buildPendenciaPagaSingleDateQuery(filter: NormalizedFilter): string {
    return `${buildPendenciaPagaSingleDateQuery({ todosVanzeiros: filter.todosVanzeiros, consorcioFilterParamIndex: 5 }).trim()} ${filter.desativados? 'AND pu.bloqueado = true' : ''}`;
  }
  private buildPendenciaPagamentoSingleDateQuery(filter: NormalizedFilter, statuses: Array<StatusPagamento.ERRO_ESTORNO | StatusPagamento.ERRO_REJEITADO>): string {
    return `${buildPendenciaPagamentoSingleDateQuery({ todosVanzeiros: filter.todosVanzeiros, consorcioFilterParamIndex: 5, parentErrorStatuses: statuses }).trim()} ${filter.desativados ? 'AND pu.bloqueado = true' : ''}`;
  }
  private isSingleDate(filter: NormalizedFilter): boolean { return this.toQueryDate(filter.dataInicio) === this.toQueryDate(filter.dataFim); }
  private hasOtherStatusFilters(filter: NormalizedFilter): boolean { return Boolean(filter.pago || filter.aPagar || filter.emProcessamento || filter.erro || filter.pendenciaPaga || filter.pendentes || filter.estorno || filter.rejeitado); }
  private resolvePagination(filter: NormalizedFilter) {
    const cp = Number(filter.page); const ps = Number(filter.pageSize);
    return { currentPage: Number.isInteger(cp) && cp > 0? cp : 1, pageSize: Number.isInteger(ps) && ps > 0? ps : 50 };
  }
  private resolveCursor(filter: NormalizedFilter): CursorValues {
    const has = Boolean(filter.cursorDataReferencia) && Boolean(filter.cursorNome) && Boolean(filter.cursorStatus) && Boolean(filter.cursorCpfCnpj);
    if (!has) return { dataReferencia: null, nome: null, status: null, cpfCnpj: null, nomeConsorcio: null, codBanco: null, dataPagamento: null, email: null };
    return {
      dataReferencia: filter.cursorDataReferencia?? null,
      nome: filter.cursorNome?? null,
      status: filter.cursorStatus?? null,
      cpfCnpj: filter.cursorCpfCnpj?? null,
      nomeConsorcio: filter.cursorNomeConsorcio?? null,
      codBanco: filter.cursorCodBanco?? null,
      dataPagamento: filter.cursorDataPagamento?? null,
      email: filter.cursorEmail?? null,
    };
  }
  private getStatusParaFiltro(filter: any): string[] | null {
    const statuses: string[] = [];
    const mapping = [{ cond: filter.pago, vals: [StatusPagamento.PAGO] }, { cond: filter.erro, vals: [StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO] }, { cond: filter.estorno, vals: [StatusPagamento.ERRO_ESTORNO] }, { cond: filter.rejeitado, vals: [StatusPagamento.ERRO_REJEITADO] }, { cond: filter.emProcessamento, vals: [StatusPagamento.AGUARDANDO_PAGAMENTO] }, { cond: filter.pendenciaPaga, vals: [StatusPagamento.PENDENCIA_PAGA] }, { cond: filter.pendentes, vals: [StatusPagamento.PENDENTES] }, { cond: filter.aPagar, vals: [StatusPagamento.A_PAGAR] }];
    for (const i of mapping) if (i.cond) statuses.push(...i.vals);
    return statuses.length? [...new Set(statuses)] : null;
  }
  private getInnerQueryParameters(filter: NormalizedFilter, selectedStatuses: string[] | null): any[] {
    const consorcioNome = filter.consorcioNome?.length? filter.consorcioNome.map((n) => n.toUpperCase().trim()) : null;
    return [this.toQueryDate(filter.dataInicio), this.toQueryDate(filter.dataFim), filter.userIds?.length? filter.userIds : null, selectedStatuses, consorcioNome];
  }
  private getQueryParameters(filter: NormalizedFilter, selectedStatuses: string[] | null): any[] { return this.getInnerQueryParameters(filter, selectedStatuses); }
  private toQueryDate(date: Date): string { return date.toISOString().slice(0, 10); }
  private async executeQuery<T = any>(query: string, params: any[], label: string): Promise<T[]> {
    try { return await this.dataSource.query(query, params); } catch (error) { this.logger.error(`Erro ao executar a query (${label})`, error); throw error; }
  }
}
