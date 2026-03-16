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

type NormalizedFilter = IFindPublicacaoRelatorioNovoFinancialMovement & {
  dataInicio: Date;
  dataFim: Date;
  page?: number;
  pageSize?: number;
};

type ResolvedStatuses = {
  allSelectedStatuses: string[] | null;
  baseStatuses: string[] | null;
  includePendentes: boolean;
  includeBase: boolean;
};

@Injectable()
export class RelatorioNovoRemessaFinancialMovementRepository {
  private readonly logger = new CustomLogger(
    RelatorioNovoRemessaFinancialMovementRepository.name,
    { timestamp: true },
  );

  private readonly CONSORCIO_CASE = `
    CASE
      WHEN pu."permitCode" = '8' THEN 'VLT'
      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
      WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
      ELSE op."nomeConsorcio"
    END
  `;

  private readonly STATUS_CASE = `
    CASE
      WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
      WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
      WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
      WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
      WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
      ELSE 'Rejeitado'
    END
  `;

  private readonly NOT_CPF_FILTER = `
    AND pu."cpfCnpj" NOT IN (
      '18201378000119',
      '12464869000176',
      '12464539000180',
      '12464553000184',
      '44520687000161',
      '12464577000133'
    )
  `;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  public async findFinancialMovementSummary(
    filter: IFindPublicacaoRelatorioNovoFinancialMovement,
  ): Promise<RelatorioFinancialMovementNovoRemessaSummaryDto> {
    const safeFilter = this.normalizeFilter(filter);
    const statuses = this.resolveStatuses(safeFilter);
    const params = this.getQueryParameters(safeFilter, statuses.allSelectedStatuses);

    const finalBaseQuery = this.buildFinalBaseQuery(safeFilter, statuses);

    const groupedCte = this.buildGroupedCte(finalBaseQuery);

    const countQuery = `
      ${groupedCte}
      SELECT COUNT(*)::int AS count
      FROM grouped
    `;

    const aggregatesQuery = `
      WITH base AS (
        ${finalBaseQuery}
      )
      SELECT
        COALESCE(SUM(valor), 0) AS "valorTotal",
        COALESCE(SUM(CASE WHEN status = 'Pago' THEN valor ELSE 0 END), 0) AS "valorPago",
        COALESCE(SUM(CASE WHEN status = 'Estorno' THEN valor ELSE 0 END), 0) AS "valorEstornado",
        COALESCE(SUM(CASE WHEN status = 'Rejeitado' THEN valor ELSE 0 END), 0) AS "valorRejeitado",
        COALESCE(SUM(CASE WHEN status = 'Aguardando Pagamento' THEN valor ELSE 0 END), 0) AS "valorAguardandoPagamento",
        COALESCE(SUM(CASE WHEN status = 'Pendentes' THEN valor ELSE 0 END), 0) AS "valorPendente",
        COALESCE(SUM(CASE WHEN status = 'Pendencia Paga' THEN valor ELSE 0 END), 0) AS "valorPendenciaPaga"
      FROM base
    `;

    try {
      const [countRows, aggregateRows] = await Promise.all([
        this.dataSource.query(countQuery, params),
        this.dataSource.query(aggregatesQuery, params),
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
        valorPendente: Number(aggregates.valorPendente ?? 0),
        valorPendenciaPaga: Number(aggregates.valorPendenciaPaga ?? 0),
      });
    } catch (error) {
      this.logger.error('Erro ao executar a query', error);
      throw error;
    }
  }

  public async findFinancialMovementPage(
    filter: IFindPublicacaoRelatorioNovoFinancialMovement,
  ): Promise<RelatorioFinancialMovementNovoRemessaPageDto> {
    const safeFilter = this.normalizeFilter(filter);
    const statuses = this.resolveStatuses(safeFilter);
    const params = this.getQueryParameters(safeFilter, statuses.allSelectedStatuses);

    const finalBaseQuery = this.buildFinalBaseQuery(safeFilter, statuses);
    const groupedCte = this.buildGroupedCte(finalBaseQuery);

    const { currentPage, pageSize } = this.resolvePagination(safeFilter);

    const hasCursor =
      Boolean(safeFilter.cursorDataReferencia)
      && Boolean(safeFilter.cursorNome)
      && Boolean(safeFilter.cursorStatus)
      && Boolean(safeFilter.cursorCpfCnpj);

    const cursorDataReferencia = hasCursor ? safeFilter.cursorDataReferencia : null;
    const cursorNome = hasCursor ? safeFilter.cursorNome : null;
    const cursorStatus = hasCursor ? safeFilter.cursorStatus : null;
    const cursorCpfCnpj = hasCursor ? safeFilter.cursorCpfCnpj : null;

    const dataQuery = `
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
      WHERE (
        $8::text IS NULL
        OR (g."dataReferencia", g.nomes, g.status, g."cpfCnpj") > (to_date($8, 'DD/MM/YYYY'), $9::text, $10::text, $11::text)
      )
      ORDER BY g."dataReferencia" ASC, g.nomes ASC, g.status ASC, g."cpfCnpj" ASC
      LIMIT $12
    `;

    try {
      const dataParams = [
        ...params,
        cursorDataReferencia,
        cursorNome,
        cursorStatus,
        cursorCpfCnpj,
        pageSize,
      ];
      const rows = await this.dataSource.query(dataQuery, dataParams);

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
    } catch (error) {
      this.logger.error('Erro ao executar a query', error);
      throw error;
    }
  }

  private buildGroupedCte(finalBaseQuery: string): string {
    return `
      WITH base AS (
        ${finalBaseQuery}
      ),
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
        allSelectedStatuses: null,
        baseStatuses: null,
        includePendentes: false,
        includeBase: true,
      };
    }

    const includePendentes = allSelectedStatuses.includes(StatusPagamento.PENDENTES);
    const baseStatuses = allSelectedStatuses.filter(
      (status) => status !== StatusPagamento.PENDENTES,
    );

    return {
      allSelectedStatuses,
      baseStatuses: baseStatuses.length ? baseStatuses : null,
      includePendentes,
      includeBase: baseStatuses.length > 0,
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
    return `
      SELECT DISTINCT
        da."dataVencimento" AS "dataReferencia",
        opa.id,
        pu."fullName" AS nomes,
        pu.email,
        pu."bankCode" AS "codBanco",
        bc.name AS "nomeBanco",
        pu."cpfCnpj",
        ${this.CONSORCIO_CASE} AS "nomeConsorcio",
        da."valorLancamento" AS valor,
        CASE
          WHEN oph."statusRemessa" = 5
            AND opa."ordemPagamentoAgrupadoId" IS NOT NULL
            THEN op_pai."dataPagamento"
          ELSE opa."dataPagamento"
        END AS "dataPagamento",
        ${this.STATUS_CASE} AS status
      FROM ordem_pagamento op
      INNER JOIN ordem_pagamento_agrupado opa
        ON op."ordemPagamentoAgrupadoId" = opa.id
      LEFT JOIN ordem_pagamento_agrupado op_pai
        ON op_pai.id = opa."ordemPagamentoAgrupadoId"
      INNER JOIN ordem_pagamento_agrupado_historico oph
        ON oph."ordemPagamentoAgrupadoId" = opa.id
      INNER JOIN detalhe_a da
        ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
      INNER JOIN public."user" pu
        ON pu.id = op."userId"
      INNER JOIN bank bc
        ON bc.code = pu."bankCode"
      WHERE
        da."dataVencimento" BETWEEN $1 AND $2
        AND ($3::integer[] IS NULL OR pu.id = ANY($3))
        AND ($4::text[] IS NULL OR ${this.STATUS_CASE} = ANY($4))
        AND ($5::text[] IS NULL OR ${this.CONSORCIO_CASE} = ANY($5))
        AND (
          ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric)
          AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ordem_pagamento_agrupado filha
          WHERE filha."ordemPagamentoAgrupadoId" = opa.id
        )
        AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
        ${filter.todosVanzeiros ? this.NOT_CPF_FILTER : ''}
        ${filter.desativados ? 'AND pu.bloqueado = true' : ''}
    `;
  }

  private buildPendentesQuery(filter: NormalizedFilter): string {
    return `
    SELECT DISTINCT
      DATE(op."dataOrdem") AS "dataReferencia",
      NULL::integer AS id,
      op."nomeOperadora" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj",
      ${this.CONSORCIO_CASE} AS "nomeConsorcio",
      op.valor AS valor,
      op."dataOrdem" AS "dataPagamento",
      'Pendentes' AS status
    FROM ordem_pagamento op
    INNER JOIN public."user" pu
      ON pu.id = op."userId"
    INNER JOIN bank bc
      ON bc.code = pu."bankCode"
    WHERE
      op."dataOrdem" BETWEEN $1 AND $2
      AND op."ordemPagamentoAgrupadoId" IS NULL
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR 'Pendentes' = ANY($4))
      AND ($5::text[] IS NULL OR ${this.CONSORCIO_CASE} = ANY($5))
      AND (
        ($6::numeric IS NULL OR op.valor >= $6::numeric)
        AND ($7::numeric IS NULL OR op.valor <= $7::numeric)
      )
      ${filter.todosVanzeiros ? this.NOT_CPF_FILTER : ''}
      ${filter.desativados ? 'AND pu.bloqueado = true' : ''}
  `;
  }
  private resolvePagination(filter: NormalizedFilter) {
    const currentPageRaw = Number(filter.page);
    const pageSizeRaw = Number(filter.pageSize);

    const currentPage =
      Number.isInteger(currentPageRaw) && currentPageRaw > 0 ? currentPageRaw : 1;

    const pageSize =
      Number.isInteger(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 50;

    const hasPagination =
      Number.isInteger(filter.page) || Number.isInteger(filter.pageSize);

    return {
      currentPage,
      pageSize,
      hasPagination,
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
}
