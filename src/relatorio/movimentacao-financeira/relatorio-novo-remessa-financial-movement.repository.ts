import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { format } from 'date-fns';
import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import {
  buildBaseQuery,
  buildEleicaoQuery,
  buildPendentesQuery,
  buildPendenciaPagaSingleDateQuery,
  CONSORCIO_CASE,
  NOT_CPF_FILTER,
  STATUS_CASE,
} from '../novo-remessa/queries/novo-remessa-query-builder';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import {
  RelatorioFinancialMovementNovoRemessaData,
  RelatorioFinancialMovementNovoRemessaPageDto,
  RelatorioFinancialMovementNovoRemessaSummaryDto,
} from '../dtos/relatorio-financial-and-movement.dto';

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
  includePendenciaPagaSingleDate: boolean;
};

type CursorValues = {
  dataReferencia: string | null;
  nome: string | null;
  status: string | null;
  cpfCnpj: string | null;
};

@Injectable()
export class RelatorioNovoRemessaFinancialMovementRepository {
  private readonly logger = new CustomLogger(
    RelatorioNovoRemessaFinancialMovementRepository.name,
    { timestamp: true },
  );

  private readonly CONSORCIO_CASE = CONSORCIO_CASE;
  private readonly STATUS_CASE = STATUS_CASE;
  private readonly NOT_CPF_FILTER = NOT_CPF_FILTER;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  public async findFinancialMovementSummary(
    filter: IFindPublicacaoRelatorioNovoFinancialMovement,
  ): Promise<RelatorioFinancialMovementNovoRemessaSummaryDto> {
    const safeFilter = this.normalizeFilter(filter);
    const statuses = this.resolveStatuses(safeFilter);
    const params = this.getQueryParameters(safeFilter, statuses.baseStatuses);

    const finalBaseQuery = this.buildFinalBaseQuery(safeFilter, statuses);
    const { countQuery, aggregatesQuery } = this.buildSummaryQueries(finalBaseQuery);

    const [countRows, aggregateRows] = await Promise.all([
      this.executeQuery(countQuery, params, 'COUNT'),
      this.executeQuery(aggregatesQuery, params, 'SUM'),
    ]);

    const totalCount = Number(countRows?.[0]?.count ?? 0);
    const aggregates = aggregateRows?.[0] ?? {};
    return new RelatorioFinancialMovementNovoRemessaSummaryDto({
      count: totalCount,
      valorTotal: Number.parseFloat((aggregates.valorTotal ?? 0).toString()),
      valorPago: Number(aggregates.valorPago ?? 0),
      valorEstornado: Number(aggregates.valorEstornado ?? 0),
      valorRejeitado: Number(aggregates.valorRejeitado ?? 0),
      valorAguardandoPagamento: Number(aggregates.valorAguardandoPagamento ?? 0),
      valorAPagar: Number(aggregates.valorAPagar ?? 0),
      valorPendente: Number(aggregates.valorPendente ?? 0),
      valorPendenciaPaga: Number(aggregates.valorPendenciaPaga ?? 0),
    });
  }

  public async findFinancialMovementPage(
    filter: IFindPublicacaoRelatorioNovoFinancialMovement,
  ): Promise<RelatorioFinancialMovementNovoRemessaPageDto> {
    const safeFilter = this.normalizeFilter(filter);
    const { query, params } = this.buildBaseDataQuery(safeFilter);
    const { currentPage, pageSize } = this.resolvePagination(safeFilter);
    const cursor = this.resolveCursor(safeFilter);

    const dataQuery = `
      ${query}
      WHERE (
        $8::text IS NULL
        OR (g."dataReferencia", g.nomes, g.status, g."cpfCnpj") > (to_date($8, 'DD/MM/YYYY'), $9::text, $10::text, $11::text)
      )
      ORDER BY g."dataReferencia" ASC, g.nomes ASC, g.status ASC, g."cpfCnpj" ASC
      LIMIT $12
    `;

    const dataParams = [
      ...params,
      cursor.dataReferencia,
      cursor.nome,
      cursor.status,
      cursor.cpfCnpj,
      pageSize,
    ];
    const rows = await this.executeQuery(dataQuery, dataParams, 'PAGE');

    const data = rows.map((row) => new RelatorioFinancialMovementNovoRemessaData(row));
    const lastRow = rows?.[rows.length - 1];
    const nextCursor = lastRow
      ? {
        dataReferencia: lastRow.dataReferencia,
        nomes: lastRow.nomes,
        status: lastRow.status,
        cpfCnpj: lastRow.cpfCnpj,
      }
      : null;

    return new RelatorioFinancialMovementNovoRemessaPageDto({
      currentPage,
      pageSize,
      data,
      nextCursor,
    });
  }

  public async streamFinancialMovementRows(
    filter: IFindPublicacaoRelatorioNovoFinancialMovement,
    onRow: (row: RelatorioFinancialMovementNovoRemessaData) => Promise<void> | void,
  ): Promise<void> {
    const safeFilter = this.normalizeFilter(filter);
    let cursor: CursorValues = {
      dataReferencia: null,
      nome: null,
      status: null,
      cpfCnpj: null,
    };
    const batchSize = 500;

    try {
      while (true) {
        const rows = await this.findFinancialMovementBatchRows(safeFilter, cursor, batchSize, 'EXPORT');

        if (!rows.length) {
          break;
        }

        for (const row of rows) {
          await onRow(new RelatorioFinancialMovementNovoRemessaData(row));
        }

        const lastRow = rows[rows.length - 1];
        cursor = {
          dataReferencia: lastRow.dataReferencia,
          nome: lastRow.nomes,
          status: lastRow.status,
          cpfCnpj: lastRow.cpfCnpj,
        };

        if (rows.length < batchSize) {
          break;
        }
      }

      this.logger.debug('EXPORT finished');
    } catch (error) {
      this.logger.error('Erro ao executar a query (EXPORT)', error);
      throw error;
    }
  }

  private buildBaseCte(finalBaseQuery: string): string {
    return `
      WITH base AS (
        ${finalBaseQuery}
      )
    `;
  }

  private buildGroupedCte(finalBaseQuery: string): string {
    return `
      ${this.buildBaseCte(finalBaseQuery)},
      grouped AS (
        SELECT
          "dataReferencia",
          nomes,
          email,
          "codBanco",
          "nomeBanco",
          "cpfCnpj",
          "nomeConsorcio",
          status,
          "dataPagamento",
          SUM(valor) AS valor
        FROM base
        GROUP BY
          "dataReferencia",
          nomes,
          email,
          "codBanco",
          "nomeBanco",
          "cpfCnpj",
          "nomeConsorcio",
          status,
          "dataPagamento"
      )
    `;
  }

  private buildSummaryQueries(finalBaseQuery: string) {
    const groupedCte = this.buildGroupedCte(finalBaseQuery);
    const countQuery = `
      ${groupedCte}
      SELECT COUNT(*)::int AS count
      FROM grouped
    `;

    const aggregatesQuery = `
      ${this.buildBaseCte(finalBaseQuery)}
      SELECT
        COALESCE(SUM(valor), 0) AS "valorTotal",
        COALESCE(SUM(CASE WHEN status = 'Pago' THEN valor ELSE 0 END), 0) AS "valorPago",
        COALESCE(SUM(CASE WHEN status = 'Estorno' THEN valor ELSE 0 END), 0) AS "valorEstornado",
        COALESCE(SUM(CASE WHEN status = 'Rejeitado' THEN valor ELSE 0 END), 0) AS "valorRejeitado",
        COALESCE(SUM(CASE WHEN status = 'Aguardando Pagamento' THEN valor ELSE 0 END), 0) AS "valorAguardandoPagamento",
        COALESCE(SUM(CASE WHEN status = 'A Pagar' THEN valor ELSE 0 END), 0) AS "valorAPagar",
        COALESCE(SUM(CASE WHEN status = 'Pendentes' THEN valor ELSE 0 END), 0) AS "valorPendente",
        COALESCE(SUM(CASE WHEN status = 'Pendencia Paga' THEN valor ELSE 0 END), 0) AS "valorPendenciaPaga"
      FROM base
    `;

    return {
      countQuery,
      aggregatesQuery,
    };
  }

  private buildBaseDataQuery(filter: NormalizedFilter) {
    const statuses = this.resolveStatuses(filter);
    const params = this.getQueryParameters(filter, statuses.baseStatuses);
    const finalBaseQuery = this.buildFinalBaseQuery(filter, statuses);
    const groupedCte = this.buildGroupedCte(finalBaseQuery);

    return {
      params,
      query: `
        ${groupedCte}
        SELECT
          to_char(g."dataReferencia" AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS "dataReferencia",
          to_char(g."dataPagamento" AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS "dataPagamento",
          g.nomes,
          g.email,
          g."codBanco",
          g."nomeBanco",
          g."cpfCnpj",
          g."nomeConsorcio" AS consorcio,
          g.valor,
          g.status
        FROM grouped g
      `,
    };
  }

  private async findFinancialMovementBatchRows(
    filter: NormalizedFilter,
    cursor: CursorValues,
    limit: number,
    label: string,
  ) {
    const { query, params } = this.buildBaseDataQuery(filter);
    const dataQuery = `
      ${query}
      WHERE (
        $8::text IS NULL
        OR (g."dataReferencia", g.nomes, g.status, g."cpfCnpj") > (to_date($8, 'DD/MM/YYYY'), $9::text, $10::text, $11::text)
      )
      ORDER BY g."dataReferencia" ASC, g.nomes ASC, g.status ASC, g."cpfCnpj" ASC
      LIMIT $12
    `;

    return this.executeQuery(dataQuery, [
      ...params,
      cursor.dataReferencia,
      cursor.nome,
      cursor.status,
      cursor.cpfCnpj,
      limit,
    ], label);
  }

  private normalizeFilter(
    filter: IFindPublicacaoRelatorioNovoFinancialMovement,
  ): NormalizedFilter {
    return {
      ...filter,
      dataInicio: new Date(filter.dataInicio),
      dataFim: new Date(filter.dataFim),
      page: filter.page ? Number(filter.page) : undefined,
      pageSize: filter.pageSize ? Number(filter.pageSize) : undefined,
    };
  }

  private resolveStatuses(filter: NormalizedFilter): ResolvedStatuses {
    const allSelectedStatuses = this.getStatusParaFiltro(filter);

    if (!allSelectedStatuses?.length) {
      return {
        baseStatuses: null,
        includePendentes: false,
        includeBase: true,
        includePendenciaPagaSingleDate: false,
      };
    }

    const includePendentes = allSelectedStatuses.includes(StatusPagamento.PENDENTES);
    const includePendenciaPagaSingleDate = this.isSingleDate(filter)
      && allSelectedStatuses.includes(StatusPagamento.PENDENCIA_PAGA);
    const baseStatuses = allSelectedStatuses.filter((status) =>
      status !== StatusPagamento.PENDENTES
      && (!includePendenciaPagaSingleDate || status !== StatusPagamento.PENDENCIA_PAGA),
    );

    return {
      baseStatuses: baseStatuses.length ? baseStatuses : null,
      includePendentes,
      includeBase: baseStatuses.length > 0,
      includePendenciaPagaSingleDate,
    };
  }

  private buildFinalBaseQuery(
    filter: NormalizedFilter,
    statuses: ResolvedStatuses,
  ): string {
    if (filter.eleicao && !this.hasOtherStatusFilters(filter)) {
      return this.buildEleicaoQuery(filter);
    }

    const queries: string[] = [];

    if (filter.eleicao) {
      queries.push(this.buildEleicaoQuery(filter));
    }

    if (statuses.includeBase) {
      queries.push(this.buildBaseQuery(filter));
    }

    if (statuses.includePendenciaPagaSingleDate) {
      queries.push(this.buildPendenciaPagaSingleDateQuery(filter));
    }

    if (statuses.includePendentes) {
      queries.push(this.buildPendentesQuery(filter));
    }

    if (!queries.length) {
      // case: user selected only Pendentes? handled above
      // safety fallback to base query
      return this.buildBaseQuery(filter);
    }

    return queries.join('\nUNION ALL\n');
  }

  private buildBaseQuery(filter: NormalizedFilter): string {
    const baseQuery = buildBaseQuery({
      todosVanzeiros: filter.todosVanzeiros,
      consorcioFilterParamIndex: 5,
    }).trim();
    return `
      ${baseQuery}
      ${filter.desativados ? 'AND pu.bloqueado = true' : ''}
    `;
  }

  private buildEleicaoQuery(filter: NormalizedFilter): string {
    const baseQuery = buildEleicaoQuery({
      todosVanzeiros: filter.todosVanzeiros,
      consorcioFilterParamIndex: 5,
    }).trim();
    return `
      ${baseQuery}
      ${filter.desativados ? 'AND pu.bloqueado = true' : ''}
    `;
  }

  private buildPendentesQuery(filter: NormalizedFilter): string {
    const pendentesBase = buildPendentesQuery({ todosVanzeiros: filter.todosVanzeiros }).trim();
    return `
    ${pendentesBase}
      ${filter.desativados ? 'AND pu.bloqueado = true' : ''}
  `;
  }

  private buildPendenciaPagaSingleDateQuery(filter: NormalizedFilter): string {
    const baseQuery = buildPendenciaPagaSingleDateQuery({
      todosVanzeiros: filter.todosVanzeiros,
      consorcioFilterParamIndex: 5,
    }).trim();
    return `
      ${baseQuery}
      ${filter.desativados ? 'AND pu.bloqueado = true' : ''}
    `;
  }

  private isSingleDate(filter: NormalizedFilter): boolean {
    return format(filter.dataInicio, 'yyyy-MM-dd') === format(filter.dataFim, 'yyyy-MM-dd');
  }

  private hasOtherStatusFilters(filter: NormalizedFilter): boolean {
    return Boolean(
      filter.pago
      || filter.aPagar
      || filter.emProcessamento
      || filter.erro
      || filter.pendenciaPaga
      || filter.pendentes
      || filter.estorno
      || filter.rejeitado,
    );
  }

  private resolvePagination(filter: NormalizedFilter) {
    const currentPageRaw = Number(filter.page);
    const pageSizeRaw = Number(filter.pageSize);

    const currentPage =
      Number.isInteger(currentPageRaw) && currentPageRaw > 0 ? currentPageRaw : 1;

    const pageSize =
      Number.isInteger(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 50;

    return {
      currentPage,
      pageSize,
    };
  }

  private resolveCursor(filter: NormalizedFilter): CursorValues {
    const hasCursor =
      Boolean(filter.cursorDataReferencia)
      && Boolean(filter.cursorNome)
      && Boolean(filter.cursorStatus)
      && Boolean(filter.cursorCpfCnpj);

    if (!hasCursor) {
      return {
        dataReferencia: null,
        nome: null,
        status: null,
        cpfCnpj: null,
      };
    }

    return {
      dataReferencia: filter.cursorDataReferencia ?? null,
      nome: filter.cursorNome ?? null,
      status: filter.cursorStatus ?? null,
      cpfCnpj: filter.cursorCpfCnpj ?? null,
    };
  }

  private getStatusParaFiltro(filter: {
    pago?: boolean;
    erro?: boolean;
    estorno?: boolean;
    rejeitado?: boolean;
    emProcessamento?: boolean;
    pendenciaPaga?: boolean;
    pendentes?: boolean;
    aPagar?: boolean;
  }): string[] | null {
    const statuses: string[] = [];

    const mapping: { cond?: boolean; vals: StatusPagamento[] }[] = [
      { cond: filter.pago, vals: [StatusPagamento.PAGO] },
      { cond: filter.erro, vals: [StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO, StatusPagamento.PENDENTES] },
      { cond: filter.estorno, vals: [StatusPagamento.ERRO_ESTORNO] },
      { cond: filter.rejeitado, vals: [StatusPagamento.ERRO_REJEITADO] },
      { cond: filter.emProcessamento, vals: [StatusPagamento.AGUARDANDO_PAGAMENTO] },
      { cond: filter.pendenciaPaga, vals: [StatusPagamento.PENDENCIA_PAGA] },
      { cond: filter.pendentes, vals: [StatusPagamento.PENDENTES] },
      { cond: filter.aPagar, vals: [StatusPagamento.A_PAGAR] },
    ];

    for (const item of mapping) {
      if (item.cond) statuses.push(...item.vals);
    }

    return statuses.length ? [...new Set(statuses)] : null;
  }

  private getQueryParameters(
    filter: NormalizedFilter,
    selectedStatuses: string[] | null,
  ): any[] {
    const consorcioNome = filter.consorcioNome?.length
      ? filter.consorcioNome.map((nome) => nome.toUpperCase().trim())
      : null;

    return [
      format(filter.dataInicio, 'yyyy-MM-dd'),
      format(filter.dataFim, 'yyyy-MM-dd'),
      filter.userIds?.length ? filter.userIds : null,
      selectedStatuses,
      consorcioNome,
      filter.valorMin ?? null,
      filter.valorMax ?? null,
    ];
  }

  private async executeQuery<T = any>(
    query: string,
    params: any[],
    label: string,
  ): Promise<T[]> {
    try {
      const result = await this.dataSource.query(query, params);
      this.logger.debug(`${label} finished`);
      return result;
    } catch (error) {
      this.logger.error(`Erro ao executar a query (${label})`, error);
      throw error;
    }
  }
}
