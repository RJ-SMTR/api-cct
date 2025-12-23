import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { DataSource } from 'typeorm';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import { RelatorioFinancialMovementNovoRemessaData, RelatorioFinancialMovementNovoRemessaDto } from '../dtos/relatorio-financial-and-movement.dto';

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
      WHEN oph."motivoStatusRemessa" = 'AL' AND oph."statusRemessa" = 4 THEN 'Rejeitado'
      ELSE 'Rejeitado'
    END
  )`;

  private readonly notCpf = `AND pu."cpfCnpj" NOT IN ('18201378000119','12464869000176','12464539000180','12464553000184','44520687000161','12464577000133')`;

  private readonly queryReport = `
SELECT DISTINCT 
    da."dataVencimento" AS "dataReferencia",
    pu."fullName" AS nomes,
    pu.email,
    pu."bankCode" AS "codBanco",
    bc.name AS "nomeBanco",
    pu."cpfCnpj",
    ${this.CONSORCIO_CASE} AS "nomeConsorcio",
    da."valorLancamento" AS valor,
    opa."dataPagamento",
    ${this.STATUS_CASE} AS status
FROM
    ordem_pagamento op
    INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
    INNER JOIN public."user" pu ON pu."id" = op."userId"
    JOIN bank bc on bc.code = pu."bankCode"
    INNER JOIN cadeia_pagamento cp ON cp.ordem_id = opa.id
WHERE
    da."dataVencimento" BETWEEN $1 AND $2
    AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
    AND ($5::text[] IS NULL OR TRIM(UPPER(op."nomeConsorcio")) = ANY($5))
    AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric) 
        AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
    )
    AND (
        $4::text[] IS NULL OR ${this.STATUS_CASE} = ANY($4)
    )
    AND (
        oph."motivoStatusRemessa" = '02' OR
        (oph."motivoStatusRemessa" NOT IN ('00','BD') AND oph."statusRemessa" NOT IN (3,5))
    )
    AND cp.raiz_id NOT IN (SELECT raiz_id FROM cadeias_com_paga)
    AND (oph."motivoStatusRemessa" NOT IN ('AM') OR oph."motivoStatusRemessa" IS NULL)
    and oph."statusRemessa" <> 5`;

  private readonly queryReportNoCadeia = `
SELECT DISTINCT 
    da."dataVencimento" AS "dataReferencia",
    pu."fullName" AS nomes,
    pu.email,
    pu."bankCode" AS "codBanco",
    bc.name AS "nomeBanco",
    pu."cpfCnpj",
    ${this.CONSORCIO_CASE} AS "nomeConsorcio",
    da."valorLancamento" AS valor,
    opa."dataPagamento",
    ${this.STATUS_CASE} AS status
FROM
    ordem_pagamento op
    INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
    INNER JOIN public."user" pu ON pu."id" = op."userId"
    JOIN bank bc on bc.code = pu."bankCode"
WHERE
    da."dataVencimento" BETWEEN $1 AND $2
    AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
    AND ($5::text[] IS NULL OR TRIM(UPPER(op."nomeConsorcio")) = ANY($5))
    AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric) 
        AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
    )
    AND (
        $4::text[] IS NULL OR ${this.STATUS_CASE} = ANY($4)
    )
    AND (oph."motivoStatusRemessa" NOT IN ('AM', '02') OR oph."motivoStatusRemessa" IS NULL)
    and oph."statusRemessa" <> 5`;
  private eleicao = `
  SELECT DISTINCT
      da."dataVencimento" AS dataPagamento,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj",
    opu."consorcio" AS "nomeConsorcio",
      da."valorLancamento" AS valor,
      ${this.STATUS_CASE} AS status
  FROM
    ordem_pagamento_agrupado opa 
      INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
      INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
      inner join ordem_pagamento_unico opu on opu."idOrdemPagamento" = opa.id::VARCHAR
      inner join public."user" pu on pu."cpfCnpj" = opu."operadoraCpfCnpj"
       JOIN bank bc on bc.code = pu."bankCode"
  WHERE
      da."dataVencimento" BETWEEN $1 AND $2
      AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
      AND ($5::text[] IS NULL OR TRIM(UPPER(opu."consorcio")) = ANY($5))
      AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric) 
        AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
      )
    AND (
        $4::text[] IS NULL OR ${this.STATUS_CASE} = ANY($4)
    )
  `;

  private readonly pendenciasPagasSQL = `
    SELECT DISTINCT
    op."dataCaptura" AS "dataReferencia",
    pu."fullName" AS nomes,
    pu.email,
    pu."bankCode" AS "codBanco",
    bc.name AS "nomeBanco",
    pu."cpfCnpj",
    ${this.CONSORCIO_CASE} AS "nomeConsorcio",
    CASE 
        WHEN oph."statusRemessa" = 5 THEN ROUND(op."valor", 3)
        ELSE da."valorLancamento"
    END AS valor,
    CASE 
        WHEN oph."statusRemessa" = 5 THEN opa."dataPagamento"
        ELSE oph."dataReferencia"
    END AS dataPagamento,
    'Pendencia Paga' AS status
FROM
     ordem_pagamento op
     INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
     INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
     INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
     INNER JOIN public."user" pu ON pu."id" = op."userId"
     LEFT JOIN bank bc ON bc.code = pu."bankCode"
WHERE
    da."dataVencimento" BETWEEN $1 AND $2
    AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
    AND ($5::text[] IS NULL OR TRIM(UPPER(op."nomeConsorcio")) = ANY($5))
    AND (
        ($6::numeric IS NULL OR op."valor" >= $6::numeric) 
        AND ($7::numeric IS NULL OR op."valor" <= $7::numeric)
    )
    AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric) 
        AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
    )
    and oph."statusRemessa" IN (5)

	AND (oph."motivoStatusRemessa" NOT IN ('AM') OR oph."motivoStatusRemessa" IS NULL)
`;


  private readonly WITH_AS = `
  WITH RECURSIVE

pendencia AS (
  SELECT DISTINCT opaa.id, oph."dataReferencia"
  FROM ordem_pagamento_agrupado opaa
  INNER JOIN ordem_pagamento_agrupado_historico oph 
      ON oph."ordemPagamentoAgrupadoId" = opaa.id
  INNER JOIN detalhe_a daa 
      ON daa."ordemPagamentoAgrupadoHistoricoId" = oph.id
  WHERE daa."dataVencimento" BETWEEN $1 AND $2
    AND EXISTS (
      SELECT 1 FROM ordem_pagamento_agrupado opa2 WHERE opa2."ordemPagamentoAgrupadoId" = opaa.id
    )
  AND (
        ($6::numeric IS NULL OR daa."valorLancamento" >= $6::numeric) 
        AND ($7::numeric IS NULL OR daa."valorLancamento" <= $7::numeric)
    )

),

cadeia_pagamento (ordem_id, pai_id, raiz_id) AS (
  SELECT opa.id, opa."ordemPagamentoAgrupadoId", opa.id
  FROM ordem_pagamento_agrupado opa

  UNION ALL

  SELECT filho.id, filho."ordemPagamentoAgrupadoId", pai.raiz_id
  FROM ordem_pagamento_agrupado filho
  INNER JOIN cadeia_pagamento pai
      ON filho."ordemPagamentoAgrupadoId" = pai.ordem_id
),

cadeias_com_paga AS (
  SELECT DISTINCT cp.raiz_id
  FROM cadeia_pagamento cp
  INNER JOIN ordem_pagamento_agrupado_historico oph 
      ON oph."ordemPagamentoAgrupadoId" = cp.ordem_id
  WHERE oph."statusRemessa" = 5
)
`;

  private readonly pendenciasPagasEstRejSQL = `
SELECT DISTINCT
    oph."dataReferencia" AS "dataReferencia",
    uu."fullName" AS nomes,
    uu.email,
    uu."bankCode" AS "codBanco",
    bc.name AS "nomeBanco",
    uu."cpfCnpj",
    CASE
      WHEN uu."permitCode" = '8' THEN 'VLT'
      WHEN uu."permitCode" LIKE '4%' THEN 'STPC'
      WHEN uu."permitCode" LIKE '81%' THEN 'STPL'
      WHEN uu."permitCode" LIKE '7%' THEN 'TEC'
      ELSE op."nomeConsorcio"
    END AS "nomeConsorcio",
    CASE
        WHEN oph."statusRemessa" = 5 THEN ROUND((SELECT "valorTotal" FROM ordem_pagamento_agrupado WHERE id = opa."ordemPagamentoAgrupadoId"),3)
        ELSE da."valorLancamento"
    END AS valor,
	  pd."dataReferencia",
    'Pendencia Paga' AS status
FROM ordem_pagamento op
  INNER JOIN ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId"=opa.id
  INNER JOIN ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa.id
  INNER JOIN pendencia pd on opa."ordemPagamentoAgrupadoId" = pd.id
  LEFT JOIN detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id
  LEFT JOIN public."user" uu on uu."id"=op."userId"
  LEFT JOIN bank bc ON bc.code = uu."bankCode"
WHERE
     oph."motivoStatusRemessa" NOT IN ('AM')
    AND da."dataVencimento" IS NOT NULL
    AND ($3::integer[] IS NULL OR uu."id" = ANY($3))
    AND ($5::text[] IS NULL OR TRIM(UPPER(op."nomeConsorcio")) = ANY($5))
    AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric)
    AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
    ) 
	AND (
	  CASE
	    WHEN oph."statusRemessa" = 5 THEN ROUND(
	      (SELECT "valorTotal" FROM ordem_pagamento_agrupado WHERE id = opa."ordemPagamentoAgrupadoId"), 3
	    )
	    ELSE da."valorLancamento"
	  END
	) <> 8200.98
`;

  private pendentes = `
UNION ALL

  SELECT
  DATE(op."dataOrdem") AS dataPagamento,
  op."nomeOperadora" as nomes,
  pu.email,
  pu."bankCode" AS "codBanco",
  bc.name AS "nomeBanco",
  pu."cpfCnpj",
  ${this.CONSORCIO_CASE} AS "nomeConsorcio",
  op."valor" AS valor,
  op."dataOrdem",
  'Pendente' AS status
FROM ordem_pagamento op
INNER JOIN public."user" pu ON pu.id = op."userId"
JOIN bank bc on bc.code = pu."bankCode"
WHERE
op."dataOrdem" BETWEEN $1  AND $2 
    AND op."ordemPagamentoAgrupadoId" IS NULL
AND($3:: integer[] IS NULL OR pu."id" = ANY($3))
AND op."nomeConsorcio" = ANY(
          COALESCE(NULLIF($5::text[], '{}'), ARRAY['STPC','STPL','TEC'])
    )
and op."nomeConsorcio" <> 'VLT'
AND(
  ($6:: numeric IS NULL OR op."valor" >= $6:: numeric)
AND($7:: numeric IS NULL OR op."valor" <= $7:: numeric)
    )
`;


  constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

  private shouldUnionCadeiaAndNoCadeia = (safeFilter: any) => {
    const filtraStatusBase =
      safeFilter.aPagar || safeFilter.aguardandoPagamento || safeFilter.pago;
    const filtraPendenciaOuErro = safeFilter.pendenciaPaga || safeFilter.erro || safeFilter.estorno || safeFilter.rejeitado;
    return filtraStatusBase && filtraPendenciaOuErro;
  };

  private shouldUseCadeia(filter: IFindPublicacaoRelatorioNovoFinancialMovement): boolean {
    if (!filter) return false;
    if (filter.pendenciaPaga || filter.erro || filter.estorno || filter.rejeitado) return true;
    return false;
  }


  public async findFinancialMovement(filter: IFindPublicacaoRelatorioNovoFinancialMovement): Promise<RelatorioFinancialMovementNovoRemessaDto> {
    const safeFilter: IFindPublicacaoRelatorioNovoFinancialMovement = {
      ...filter,
      dataInicio: filter.dataInicio ? new Date(filter.dataInicio) : filter.dataInicio,
      dataFim: filter.dataFim ? new Date(filter.dataFim) : filter.dataFim,
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      let allResults: any[] = [];


      // single-query case
      const params = this.getParametersByQuery(safeFilter);
      let finalQuery: string;


      // 👇 Se deve unir as duas queries (mesma regra)
      if (this.shouldUnionCadeiaAndNoCadeia(safeFilter)) {
        finalQuery = `${this.queryReport} UNION ALL ${this.queryReportNoCadeia}`;
      } else {
        const useCadeiaSingle = this.shouldUseCadeia(safeFilter);
        finalQuery = useCadeiaSingle ? this.queryReport : this.queryReportNoCadeia;
      }
      if (safeFilter.todosVanzeiros) finalQuery += ` ${this.notCpf}`;
      if (safeFilter.eleicao) finalQuery = this.eleicao;
      if (safeFilter.pendentes) finalQuery += this.pendentes;
      if (safeFilter.pendenciaPaga) {
        finalQuery = `${finalQuery} UNION ALL ${this.pendenciasPagasSQL} UNION ALL ${this.pendenciasPagasEstRejSQL}`;
      }
      if (safeFilter.desativados) finalQuery += ` AND pu.bloqueado = true`;


      finalQuery = this.prependWithIfNeeded(finalQuery);
      allResults = await queryRunner.query(finalQuery, params);


      const aggregates = this.calculateAggregates(allResults);
      const grouped = this.groupAndSum(allResults);
      const dataOrdenada = Array.from(grouped.values())
        .sort((a, b) => {
          const dateA = this.parseDateBR(a.dataReferencia).getTime();
          const dateB = this.parseDateBR(b.dataReferencia).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return a.nomes.localeCompare(b.nomes, 'pt-BR');
        })
        .map(r => new RelatorioFinancialMovementNovoRemessaData(r));

      const relatorioDto = new RelatorioFinancialMovementNovoRemessaDto({
        count: allResults.length,
        valor: Number.parseFloat(aggregates.valorTotal.toString()),
        valorPago: aggregates.valorPago,
        valorEstornado: aggregates.valorEstornado,
        valorRejeitado: aggregates.valorRejeitado,
        valorAguardandoPagamento: aggregates.valorAguardandoPagamento,
        valorPendente: aggregates.valorPendente,
        valorPendenciaPaga: aggregates.valorPendenciaPaga,
        data: dataOrdenada,
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

  /**
   * Compute aggregates in one pass
   */
  private calculateAggregates(rows: any[]) {
    return rows.reduce(
      (acc, cur) => {
        const valor = Number.parseFloat(cur.valor || 0);
        acc.valorTotal += valor;
        switch ((cur.status || '').toString()) {
          case 'Pago':
            acc.valorPago += valor; break;
          case 'Rejeitado':
            acc.valorRejeitado += valor; break;
          case 'Estorno':
            acc.valorEstornado += valor; break;
          case 'Aguardando Pagamento':
            acc.valorAguardandoPagamento += valor; break;
          case 'Pendente':
            acc.valorPendente += valor; break;
          case 'Pendencia Paga':
            acc.valorPendenciaPaga += valor; break;
          default:
            break;
        }
        return acc;
      },
      {
        valorTotal: 0,
        valorPago: 0,
        valorRejeitado: 0,
        valorEstornado: 0,
        valorAguardandoPagamento: 0,
        valorPendente: 0,
        valorPendenciaPaga: 0,
      },
    );
  }

  /**
   * Groups by (dataReferencia | cpfCnpj) and sums values. Returns Map with ready-to-use DTO shape
   */
  private groupAndSum(rows: any[]) {
    const map = new Map<string, any>();

    for (const r of rows) {
      const dataReferencia = new Intl.DateTimeFormat('pt-BR').format(new Date(r.dataReferencia));
      const key = `${dataReferencia}|${r.cpfCnpj}|${r.status}`;
      const dataPagamento = r.dataPagamento ? new Intl.DateTimeFormat('pt-BR').format(new Date(r.dataPagamento)) : null;

      if (map.has(key)) {
        const ex = map.get(key);
        ex.valor += Number.parseFloat(r.valor || 0);
      } else {
        map.set(key, {
          dataReferencia,
          nomes: r.nomes,
          email: r.email,
          codBanco: r.codBanco,
          nomeBanco: r.nomeBanco,
          cpfCnpj: r.cpfCnpj,
          consorcio: r.nomeConsorcio || r.consorcio,
          valor: Number.parseFloat(r.valor || 0),
          status: r.status,
          dataPagamento: dataPagamento,
        });
      }
    }

    return map;
  }

  private parseDateBR(dateStr: string) {
    // dateStr expected dd/mm/yyyy
    const [d, m, y] = dateStr.split('/').map(v => Number(v));
    return new Date(y, (m || 1) - 1, d || 1);
  }


  private prependWithIfNeeded(query: string): string {
    const trimmed = query.trim();
    if (trimmed.toUpperCase().startsWith('WITH')) return query;
    return `${this.WITH_AS}${query}`;
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

    for (const m of mapping) if (m.cond) statuses.push(...m.vals);

    return statuses.length ? statuses : null;
  }



  private getParametersByQuery(filter: IFindPublicacaoRelatorioNovoFinancialMovement): any[] {
    let consorcioNome: string[] | null = filter.consorcioNome
      ? filter.consorcioNome.map(n => n.toUpperCase().trim())
      : null;

    const dataInicio = filter.dataInicio || null;
    const dataFim = filter.dataFim || null;
    const userIds = filter.userIds || null;
    const valorMin = filter.valorMin || null;
    const valorMax = filter.valorMax || null;

    if (filter.pendentes && (!consorcioNome || consorcioNome.length === 0)) {
      consorcioNome = ['STPC', 'STPL', 'TEC'];
    }

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
