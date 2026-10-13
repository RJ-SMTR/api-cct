import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { format } from 'date-fns';
import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import {
  RelatorioFinancialMovementNovoRemessaData,
  RelatorioFinancialMovementNovoRemessaPageDto,
  RelatorioFinancialMovementNovoRemessaSummaryDto,
} from '../dtos/relatorio-financial-and-movement.dto';
import {
  GUARDADOR_STATUS_CASE,
  buildGuardadorBaseQuery,
  buildGuardadorAPagarQuery,
  buildGuardadorPendenciaPagaSingleDateQuery,
  buildGuardadorPendenciaPagamentoSingleDateQuery,
} from '../novo-remessa/queries/guardador-novo-remessa-query-builder';

type NormalizedFilter = IFindPublicacaoRelatorioNovoFinancialMovement & {
  dataInicio: Date;
  dataFim: Date;
  page?: number;
  pageSize?: number;
};

type ResolvedStatuses = {
  baseStatuses: string[] | null;
  includeAPagar: boolean;
  includeBase: boolean;
  includePendenciaPagaSingleDate: boolean;
  parentErrorStatusesSingleDate: Array<StatusPagamento.ERRO_ESTORNO | StatusPagamento.ERRO_REJEITADO>;
};

type CursorValues = {
  dataReferencia: string | null;
  nome: string | null;
  status: string | null;
  cpfCnpj: string | null;
  // Tie-breakers: the "grouped" CTE aggregates by more columns than the 4 above, so two
  // grouped rows can share the same (dataReferencia, nomes, status, cpfCnpj) tuple (e.g. the
  // same guardador paid under two different consórcios on the same date/status). Without
  // these, a page boundary landing inside such a tie silently drops the remaining rows.
  nomeConsorcio: string | null;
  codBanco: string | null;
  dataPagamento: string | null;
  codigoErro: string | null;
  email: string | null;
};

// Tuple columns/expressions shared by the ORDER BY and the keyset WHERE comparison.
// COALESCE avoids Postgres row-comparison returning NULL (and silently excluding the row)
// whenever a tie-breaker column is NULL.
// Recomputes the same expression as the "dataPagamentoCursor" SELECT column below: the WHERE
// clause is appended to the same statement as that SELECT, so it cannot reference the
// SELECT-list alias (Postgres only allows that in ORDER BY), only the underlying "grouped"
// column via the table alias.
const CURSOR_TUPLE_COLUMNS = `
  g."dataReferencia",
  g.nomes,
  g.status,
  g."cpfCnpj",
  COALESCE(g."nomeConsorcio", ''),
  COALESCE(g."codBanco"::text, ''),
  COALESCE(to_char(g."dataPagamento", 'YYYY-MM-DD"T"HH24:MI:SS'), ''),
  COALESCE(g."codigoErro", ''),
  COALESCE(g.email, '')
`;

export { GUARDADOR_STATUS_CASE };

@Injectable()
export class RelatorioGuardadorFinancialMovementRepository {
  private readonly logger = new CustomLogger(
    RelatorioGuardadorFinancialMovementRepository.name,
    { timestamp: true },
  );

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

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
      AND (
        $8::text IS NULL
        OR (${CURSOR_TUPLE_COLUMNS}) > (
          to_date($8, 'DD/MM/YYYY'), $9::text, $10::text, $11::text,
          COALESCE($12::text, ''), COALESCE($13::text, ''), COALESCE($14::text, ''), COALESCE($15::text, ''), COALESCE($16::text, '')
        )
      )
      ORDER BY ${CURSOR_TUPLE_COLUMNS}
      LIMIT $17
    `;

    const dataParams = [
      ...params,
      cursor.dataReferencia,
      cursor.nome,
      cursor.status,
      cursor.cpfCnpj,
      cursor.nomeConsorcio,
      cursor.codBanco,
      cursor.dataPagamento,
      cursor.codigoErro,
      cursor.email,
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
          nomeConsorcio: lastRow.consorcio,
          codBanco: lastRow.codBanco,
          dataPagamento: lastRow.dataPagamentoCursor,
          codigoErro: lastRow.codigoErro,
          email: lastRow.email,
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
      nomeConsorcio: null,
      codBanco: null,
      dataPagamento: null,
      codigoErro: null,
      email: null,
    };
    const batchSize = 500;

    while (true) {
      const rows = await this.findFinancialMovementBatchRows(
        safeFilter,
        cursor,
        batchSize,
        'EXPORT',
      );

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
        nomeConsorcio: lastRow.consorcio,
        codBanco: lastRow.codBanco,
        dataPagamento: lastRow.dataPagamentoCursor,
        codigoErro: lastRow.codigoErro,
        email: lastRow.email,
      };

      if (rows.length < batchSize) {
        break;
      }
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
          "codigoErro",
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
          "dataPagamento",
          "codigoErro"
      )
    `;
  }

  private buildSummaryQueries(finalBaseQuery: string) {
    const groupedCte = this.buildGroupedCte(finalBaseQuery);
    const countQuery = `
      ${groupedCte}
      SELECT COUNT(*)::int AS count
      FROM grouped
      WHERE 1=1
        AND ($6::numeric IS NULL OR valor >= $6::numeric)
        AND ($7::numeric IS NULL OR valor <= $7::numeric)
    `;

    const aggregatesQuery = `
      ${groupedCte}
      SELECT
        COALESCE(SUM(valor), 0) AS "valorTotal",
        COALESCE(SUM(CASE WHEN status = 'Pago' THEN valor ELSE 0 END), 0) AS "valorPago",
        COALESCE(SUM(CASE WHEN status = 'Estorno' THEN valor ELSE 0 END), 0) AS "valorEstornado",
        COALESCE(SUM(CASE WHEN status = 'Rejeitado' THEN valor ELSE 0 END), 0) AS "valorRejeitado",
        COALESCE(SUM(CASE WHEN status = 'Aguardando Pagamento' THEN valor ELSE 0 END), 0) AS "valorAguardandoPagamento",
        COALESCE(SUM(CASE WHEN status = 'A Pagar' THEN valor ELSE 0 END), 0) AS "valorAPagar",
        COALESCE(SUM(CASE WHEN status = 'Pendentes' THEN valor ELSE 0 END), 0) AS "valorPendente",
        COALESCE(SUM(CASE WHEN status = 'Pendencia Paga' THEN valor ELSE 0 END), 0) AS "valorPendenciaPaga"
      FROM grouped
      WHERE 1=1
        AND ($6::numeric IS NULL OR valor >= $6::numeric)
        AND ($7::numeric IS NULL OR valor <= $7::numeric)
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
          CASE
            WHEN g."dataPagamento" IS NOT NULL
              THEN to_char(g."dataPagamento" AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
            ELSE '-'
          END AS "dataPagamento",
          g.nomes,
          g.email,
          g."codBanco",
          g."nomeBanco",
          g."cpfCnpj",
          g."nomeConsorcio" AS consorcio,
          g.valor,
          g.status,
          g."codigoErro",
          -- Sortable, NULL-preserving cursor value for "dataPagamento" (ISO text sorts
          -- chronologically); distinct from the DD/MM/YYYY-or-'-' display column above.
          to_char(g."dataPagamento", 'YYYY-MM-DD"T"HH24:MI:SS') AS "dataPagamentoCursor"
        FROM grouped g
        WHERE 1=1
          AND ($6::numeric IS NULL OR g.valor >= $6::numeric)
          AND ($7::numeric IS NULL OR g.valor <= $7::numeric)
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
      AND (
        $8::text IS NULL
        OR (${CURSOR_TUPLE_COLUMNS}) > (
          to_date($8, 'DD/MM/YYYY'), $9::text, $10::text, $11::text,
          COALESCE($12::text, ''), COALESCE($13::text, ''), COALESCE($14::text, ''), COALESCE($15::text, ''), COALESCE($16::text, '')
        )
      )
      ORDER BY ${CURSOR_TUPLE_COLUMNS}
      LIMIT $17
    `;

    return this.executeQuery(dataQuery, [
      ...params,
      cursor.dataReferencia,
      cursor.nome,
      cursor.status,
      cursor.cpfCnpj,
      cursor.nomeConsorcio,
      cursor.codBanco,
      cursor.dataPagamento,
      cursor.codigoErro,
      cursor.email,
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
      // Sem status selecionado, numa data única a busca deve trazer o mesmo que com "Pendencia Paga"
      // selecionada: a pendência paga é filtrada pela data de pagamento, não pelo vencimento.
      if (this.isSingleDate(filter)) {
        return {
          baseStatuses: [
            StatusPagamento.AGUARDANDO_PAGAMENTO,
            StatusPagamento.A_PAGAR,
            StatusPagamento.PAGO,
            StatusPagamento.ERRO_ESTORNO,
            StatusPagamento.ERRO_REJEITADO,
          ],
          includeAPagar: true,
          includeBase: true,
          includePendenciaPagaSingleDate: true,
          parentErrorStatusesSingleDate: [],
        };
      }

      return {
        baseStatuses: null,
        includeAPagar: true,
        includeBase: true,
        includePendenciaPagaSingleDate: false,
        parentErrorStatusesSingleDate: [],
      };
    }

    const includeAPagar = allSelectedStatuses.includes(StatusPagamento.A_PAGAR);
    const includePendenciaPagaSingleDate = this.isSingleDate(filter)
      && allSelectedStatuses.includes(StatusPagamento.PENDENCIA_PAGA);
    const parentErrorStatusesSingleDate = this.isSingleDate(filter)
      ? allSelectedStatuses.filter(
        (status): status is StatusPagamento.ERRO_ESTORNO | StatusPagamento.ERRO_REJEITADO =>
          status === StatusPagamento.ERRO_ESTORNO || status === StatusPagamento.ERRO_REJEITADO,
      )
      : [];
    const baseStatuses = allSelectedStatuses.filter(
      (status) =>
        (!includePendenciaPagaSingleDate || status !== StatusPagamento.PENDENCIA_PAGA)
        && !parentErrorStatusesSingleDate.includes(
          status as StatusPagamento.ERRO_ESTORNO | StatusPagamento.ERRO_REJEITADO,
        ),
    );

    return {
      baseStatuses: baseStatuses.length ? baseStatuses : null,
      includeAPagar,
      includeBase: baseStatuses.length > 0,
      includePendenciaPagaSingleDate,
      parentErrorStatusesSingleDate,
    };
  }

  private buildFinalBaseQuery(
    filter: NormalizedFilter,
    statuses: ResolvedStatuses,
  ): string {
    const queries: string[] = [];

    if (statuses.includeBase) {
      queries.push(this.buildBaseQuery(filter));
    }

    if (statuses.includePendenciaPagaSingleDate) {
      queries.push(this.buildPendenciaPagaSingleDateQuery(filter));
    }

    if (statuses.parentErrorStatusesSingleDate.length) {
      queries.push(this.buildPendenciaPagamentoSingleDateQuery(filter, statuses.parentErrorStatusesSingleDate));
    }

    if (statuses.includeAPagar) {
      queries.push(this.buildAPagarQuery(filter));
    }

    if (!queries.length) {
      return this.buildBaseQuery(filter);
    }

    return queries.join('\nUNION ALL\n');
  }

  private buildBaseQuery(filter: NormalizedFilter): string {
    return buildGuardadorBaseQuery({
      desativados: filter.desativados,
      todosConsorcios: filter.todosConsorcios,
    });
  }

  private buildAPagarQuery(filter: NormalizedFilter): string {
    return buildGuardadorAPagarQuery({
      desativados: filter.desativados,
      todosConsorcios: filter.todosConsorcios,
    });
  }

  private buildPendenciaPagaSingleDateQuery(filter: NormalizedFilter): string {
    return buildGuardadorPendenciaPagaSingleDateQuery({
      desativados: filter.desativados,
      todosConsorcios: filter.todosConsorcios,
    });
  }

  private buildPendenciaPagamentoSingleDateQuery(
    filter: NormalizedFilter,
    statuses: Array<StatusPagamento.ERRO_ESTORNO | StatusPagamento.ERRO_REJEITADO>,
  ): string {
    return buildGuardadorPendenciaPagamentoSingleDateQuery({
      desativados: filter.desativados,
      todosConsorcios: filter.todosConsorcios,
      parentErrorStatuses: statuses,
    });
  }

  private isSingleDate(filter: NormalizedFilter): boolean {
    return format(filter.dataInicio, 'yyyy-MM-dd') === format(filter.dataFim, 'yyyy-MM-dd');
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
    return {
      dataReferencia: filter.cursorDataReferencia ?? null,
      nome: filter.cursorNome ?? null,
      status: filter.cursorStatus ?? null,
      cpfCnpj: filter.cursorCpfCnpj ?? null,
      nomeConsorcio: filter.cursorNomeConsorcio ?? null,
      codBanco: filter.cursorCodBanco ?? null,
      dataPagamento: filter.cursorDataPagamento ?? null,
      codigoErro: filter.cursorCodigoErro ?? null,
      email: filter.cursorEmail ?? null,
    };
  }

  private getQueryParameters(
    filter: NormalizedFilter,
    baseStatuses: string[] | null,
  ): any[] {
    return [
      format(filter.dataInicio, 'yyyy-MM-dd'),
      format(filter.dataFim, 'yyyy-MM-dd'),
      filter.userIds?.length ? filter.userIds : null,
      baseStatuses?.length ? baseStatuses : null,
      filter.consorcioNome?.length
        ? filter.consorcioNome.map((c) => c.trim().toUpperCase())
        : null,
      filter.valorMin !== undefined ? filter.valorMin : null,
      filter.valorMax !== undefined ? filter.valorMax : null,
    ];
  }

  private getStatusParaFiltro(filter: NormalizedFilter): string[] {
    const statusSet = new Set<string>();

    if (filter.pago) {
      statusSet.add(StatusPagamento.PAGO);
    }
    if (filter.aPagar) {
      statusSet.add(StatusPagamento.A_PAGAR);
    }
    if (filter.emProcessamento) {
      statusSet.add(StatusPagamento.AGUARDANDO_PAGAMENTO);
    }
    if (filter.erro) {
      statusSet.add(StatusPagamento.ERRO_ESTORNO);
      statusSet.add(StatusPagamento.ERRO_REJEITADO);
      statusSet.add(StatusPagamento.PENDENTES);
    }
    if (filter.estorno) {
      statusSet.add(StatusPagamento.ERRO_ESTORNO);
    }
    if (filter.rejeitado) {
      statusSet.add(StatusPagamento.ERRO_REJEITADO);
    }
    if (filter.pendenciaPaga) {
      statusSet.add(StatusPagamento.PENDENCIA_PAGA);
    }
    if (filter.pendentes) {
      statusSet.add(StatusPagamento.PENDENTES);
    }

    return Array.from(statusSet);
  }

  private async executeQuery(query: string, params: any[], label: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      this.logger.debug(`[${label}] Executando query: ${query}`);
      return await queryRunner.query(query, params);
    } catch (error) {
      this.logger.error(`[${label}] Erro ao executar query`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
