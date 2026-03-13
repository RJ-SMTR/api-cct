import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { DataSource } from 'typeorm';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import { RelatorioFinancialMovementNovoRemessaData, RelatorioFinancialMovementNovoRemessaDto } from '../dtos/relatorio-financial-and-movement.dto';
import { format } from 'date-fns';

@Injectable()
export class RelatorioNovoRemessaFinancialMovementRepository {
  private readonly logger = new CustomLogger(RelatorioNovoRemessaFinancialMovementRepository.name, { timestamp: true });

  private readonly CONSORCIO_CASE = `(
  CASE
      WHEN pu."permitCode" = '8' THEN 'VLT'
      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
      WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
      ELSE op."nomeConsorcio"
    END
  )`

  private readonly STATUS_CASE = `(
    CASE
      WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
      WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
      WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
      WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
      WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
      ELSE 'Rejeitado'
    END
  )`;

  private readonly notCpf = `AND pu."cpfCnpj" NOT IN ('18201378000119','12464869000176','12464539000180','12464553000184','44520687000161','12464577000133')`;

  private readonly baseQuery = `
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
  ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
INNER JOIN public."user" pu
  ON pu."id" = op."userId"
JOIN bank bc
  ON bc.code = pu."bankCode"
WHERE
  da."dataVencimento" BETWEEN $1 AND $2
  AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
  AND (
    ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric) 
    AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
  )
  AND (
    $4::text[] IS NULL OR ${this.STATUS_CASE} = ANY($4)
  )
  AND (
    $5::text[] IS NULL OR ${this.CONSORCIO_CASE} = ANY($5)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM ordem_pagamento_agrupado filha
    WHERE filha."ordemPagamentoAgrupadoId" = opa.id
  )
  AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
`;

  private readonly pendentes = `
SELECT DISTINCT
  DATE(op."dataOrdem") AS "dataReferencia",
  NULL::integer AS id,
  op."nomeOperadora" as nomes,
  pu.email,
  pu."bankCode" AS "codBanco",
  bc.name AS "nomeBanco",
  pu."cpfCnpj",
  ${this.CONSORCIO_CASE} AS "nomeConsorcio",
  op."valor" AS valor,
  op."dataOrdem" AS "dataPagamento",
  'Pendentes' AS status
FROM ordem_pagamento op
INNER JOIN public."user" pu ON pu.id = op."userId"
JOIN bank bc on bc.code = pu."bankCode"
WHERE
  op."dataOrdem" BETWEEN $1  AND $2
  AND op."ordemPagamentoAgrupadoId" IS NULL
  AND ($3:: integer[] IS NULL OR pu."id" = ANY($3))
  AND op."nomeConsorcio" = ANY(
    COALESCE(NULLIF($5::text[], '{}'), ARRAY['STPC','STPL','TEC'])
  )
  AND op."nomeConsorcio" <> 'VLT'
  AND (
    ($6:: numeric IS NULL OR op."valor" >= $6:: numeric)
    AND ($7:: numeric IS NULL OR op."valor" <= $7:: numeric)
  )
`;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

  public async findFinancialMovement(filter: IFindPublicacaoRelatorioNovoFinancialMovement): Promise<RelatorioFinancialMovementNovoRemessaDto> {
    const safeFilter: IFindPublicacaoRelatorioNovoFinancialMovement = {
      ...filter,
      dataInicio: filter.dataInicio ? new Date(filter.dataInicio) : filter.dataInicio,
      dataFim: filter.dataFim ? new Date(filter.dataFim) : filter.dataFim,
      page: filter.page ? Number(filter.page) : undefined,
      pageSize: filter.pageSize ? Number(filter.pageSize) : undefined,
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      let finalQuery: string = this.baseQuery;

      if (safeFilter.todosVanzeiros) finalQuery += ` ${this.notCpf}`;
      if (safeFilter.desativados) finalQuery += ` AND pu.bloqueado = true`;

      const includePendentes = Boolean(safeFilter.pendentes || safeFilter.erro);
      if (includePendentes) {
        let pendentesQuery = this.pendentes;
        if (safeFilter.todosVanzeiros) pendentesQuery += ` ${this.notCpf}`;
        if (safeFilter.desativados) pendentesQuery += ` AND pu.bloqueado = true`;
        finalQuery = `${finalQuery}
          UNION ALL
          ${pendentesQuery}`;
      }

      const groupedCte = `
      WITH base AS (
        ${finalQuery}
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

      const hasPagination = Number.isInteger(safeFilter.page) || Number.isInteger(safeFilter.pageSize);
      const currentPageRaw = Number(safeFilter.page);
      const pageSizeRaw = Number(safeFilter.pageSize);
      const currentPage = Number.isInteger(currentPageRaw) && currentPageRaw > 0 ? currentPageRaw : 1;
      const pageSize = Number.isInteger(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 50;
      const params = this.getQueryParameters(safeFilter);

      const countQuery = `
      ${groupedCte}
      SELECT COUNT(*)::int AS count
      FROM grouped
      `;
      const aggregatesQuery = `
      WITH base AS (
      ${finalQuery}
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
      const dataQuery = `
${groupedCte}
SELECT
  TO_CHAR("dataReferencia", 'DD/MM/YYYY') AS "dataReferencia",
  TO_CHAR("dataPagamento", 'DD/MM/YYYY') AS "dataPagamento",
  nomes,
  email,
  "codBanco",
  "nomeBanco",
  "cpfCnpj",
  "nomeConsorcio" AS consorcio,
  valor,
  status
FROM grouped
ORDER BY "dataReferencia" ASC, nomes ASC, status ASC
${hasPagination ? 'OFFSET $8 LIMIT $9' : ''}
`;

      const [countRow] = await queryRunner.query(countQuery, params);
      const [aggregates] = await queryRunner.query(aggregatesQuery, params);

      const totalCount = Number(countRow?.count ?? 0);
      const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
      const safeCurrentPage = Math.min(currentPage, totalPages);
      const offset = (safeCurrentPage - 1) * pageSize;

      const dataParams = hasPagination ? [...params, offset, pageSize] : params;
      const pagedDataRaw = await queryRunner.query(dataQuery, dataParams);
      const pagedData = pagedDataRaw.map(r => new RelatorioFinancialMovementNovoRemessaData(r));

      const relatorioDto = new RelatorioFinancialMovementNovoRemessaDto({
        count: totalCount,
        valor: Number.parseFloat((aggregates?.valorTotal ?? 0).toString()),
        valorPago: aggregates?.valorPago ?? 0,
        valorEstornado: aggregates?.valorEstornado ?? 0,
        valorRejeitado: aggregates?.valorRejeitado ?? 0,
        valorAguardandoPagamento: aggregates?.valorAguardandoPagamento ?? 0,
        valorPendente: aggregates?.valorPendente ?? 0,
        valorPendenciaPaga: aggregates?.valorPendenciaPaga ?? 0,
        currentPage: safeCurrentPage,
        pageSize,
        totalPages,
        data: pagedData,
      });

      return relatorioDto;
    } catch (error) {
      this.logger.error('Erro ao executar a query', error);
      throw error;
    } finally {
      await queryRunner.release();
      this.logger.log('QueryRunner liberado.');
    }
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
      { cond: filter.aPagar, vals: [StatusPagamento.A_PAGAR] },
    ];

    for (const m of mapping) if (m.cond) statuses.push(...m.vals);

    return statuses.length ? statuses : null;
  }


  private getQueryParameters(filter: IFindPublicacaoRelatorioNovoFinancialMovement): any[] {
    let consorcioNome: string[] | null = filter.consorcioNome
      ? filter.consorcioNome.map(n => n.toUpperCase().trim())
      : null;

    const dataInicio = format(new Date(filter.dataInicio), 'yyyy-MM-dd') || null;
    const dataFim = format(new Date(filter.dataFim), 'yyyy-MM-dd') || null;
    const userIds = filter.userIds || null;
    const valorMin = filter.valorMin || null;
    const valorMax = filter.valorMax || null;

    return [
      dataInicio,
      dataFim,
      userIds,
      this.getStatusParaFiltro(filter) || null,
      consorcioNome,
      valorMin,
      valorMax
    ];
  }

}
