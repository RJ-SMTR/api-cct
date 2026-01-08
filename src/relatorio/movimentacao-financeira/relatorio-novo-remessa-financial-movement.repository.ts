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
      ELSE 'Rejeitado'
    END
  )`;

  private readonly notCpf2025 = `AND pu."cpfCnpj" NOT IN ('18201378000119','12464869000176','12464539000180','12464553000184','44520687000161','12464577000133')`;
  private readonly notCpf2024 = `AND cf."cpfCnpj" NOT IN ('18201378000119','12464869000176','12464539000180','12464553000184','44520687000161','12464577000133')`;

  private readonly queryNewReport = `
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

   ($3::integer[] IS NULL OR pu."id" = ANY($3))
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
    and oph."statusRemessa" <> 5
`;

  private readonly queryNewReportNoCadeia = `
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
    AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric) 
        AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
    )
    AND (
        $4::text[] IS NULL OR ${this.STATUS_CASE} = ANY($4)
    )
    AND (oph."motivoStatusRemessa" NOT IN ('AM', '02') OR oph."motivoStatusRemessa" IS NULL)
    and oph."statusRemessa" <> 5
`;
  private readonly queryOlderReport = `
select distinct 
  da."dataVencimento" as dataPagamento,
  cf."nome" as nomes,
  pu.email,
  pu."bankCode" AS "codBanco",
  bc.name AS "nomeBanco",
  cf."cpfCnpj",
  ita."nomeConsorcio",
  da."valorLancamento" as valor,
  ita.id,
  case 
    when da."ocorrenciasCnab" = '00' or da."ocorrenciasCnab" = 'BD' or ap."isPago" = true then 'Pago'
    when da."ocorrenciasCnab" = '02' then 'Estorno'
    else 'Rejeitado'
  end as status,
  ap."isPago"
from item_transacao it 
  inner join item_transacao_agrupado ita on it."itemTransacaoAgrupadoId" = ita."id"
  inner join detalhe_a da on da."itemTransacaoAgrupadoId" = ita.id
  inner join cliente_favorecido cf on cf.id = it."clienteFavorecidoId"
  inner join public.user pu on pu."cpfCnpj" = cf."cpfCnpj"
  inner join arquivo_publicacao ap on ap."itemTransacaoId" = it.id
  inner join header_lote hl on hl."id" = da."headerLoteId"
  inner join header_arquivo ha on ha."id" = hl."headerArquivoId"
  JOIN bank bc on bc.code = pu."bankCode"
where da."dataVencimento" between $1 and $2
  and ($4::text[] is null or TRIM(UPPER(it."nomeConsorcio")) = any($4))
  AND ($5::integer[] IS NULL OR pu."id" = ANY($5))
  and (
    ($6::numeric is null or da."valorLancamento" >= $6::numeric) and
    ($7::numeric is null or da."valorLancamento" <= $7::numeric)
  )
  AND TRIM(da."ocorrenciasCnab") <> ''
  AND ha."status" <> '5'
  and (
    $3::text[] is null or (
      case 
        when da."ocorrenciasCnab" = '00' or da."ocorrenciasCnab" = 'BD' or ap."isPago" = true then 'Pago'
        when da."ocorrenciasCnab" = '02' then 'Estorno'
        else 'Rejeitado'
      end
    ) = any($3)
  ) 
  and da."ocorrenciasCnab" <> 'AM'
`;

  private eleicao2025 = `
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
 INNER JOIN ordem_pagamento_agrupado opa 
    ON opa.id = op."ordemPagamentoAgrupadoId"
INNER JOIN cadeia_pagamento cp 
    ON cp.ordem_id = opa.id
INNER JOIN ordem_pagamento_agrupado op_pai 
    ON op_pai.id = cp.raiz_id
INNER JOIN ordem_pagamento_agrupado_historico oph 
    ON oph."ordemPagamentoAgrupadoId" = op_pai.id
INNER JOIN detalhe_a da 
    ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
INNER JOIN public."user" pu 
    ON pu.id = op."userId"
INNER JOIN bank bc 
    ON bc.code = pu."bankCode"
WHERE
    da."dataVencimento" BETWEEN $1 AND $2
        AND ($5::text[] IS NULL OR TRIM(UPPER(op."nomeConsorcio")) = ANY($5))
    AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
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
cadeia_pagamento AS (
  SELECT
    opa.id AS ordem_id,
    opa."ordemPagamentoAgrupadoId" AS pai_id,
    opa.id AS raiz_id
  FROM ordem_pagamento_agrupado opa

  UNION ALL

  SELECT
    filho.id,
    filho."ordemPagamentoAgrupadoId",
    pai.raiz_id
  FROM ordem_pagamento_agrupado filho
  INNER JOIN cadeia_pagamento pai ON filho."ordemPagamentoAgrupadoId" = pai.ordem_id
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
    pu."fullName" AS nomes,
    pu.email,
    pu."bankCode" AS "codBanco",
    bc.name AS "nomeBanco",
    pu."cpfCnpj",
    ${this.CONSORCIO_CASE} AS "nomeConsorcio",
    CASE
        WHEN oph."statusRemessa" = 5 THEN ROUND((SELECT "valorTotal" FROM ordem_pagamento_agrupado WHERE id = opa."ordemPagamentoAgrupadoId"),3)
        ELSE da."valorLancamento"
    END AS valor,
	  pd."dataReferencia" AS "dataPagamento",
    'Pendencia Paga' AS status
FROM ordem_pagamento op
  INNER JOIN ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId"=opa.id
  INNER JOIN ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa.id
  INNER JOIN pendencia pd on opa."ordemPagamentoAgrupadoId" = pd.id
  LEFT JOIN detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id
  LEFT JOIN public."user" pu on pu."id"=op."userId"
  LEFT JOIN bank bc ON bc.code = pu."bankCode"
WHERE
     oph."motivoStatusRemessa" NOT IN ('AM')
    AND da."dataVencimento" IS NOT NULL
    AND op."ordemPagamentoAgrupadoId" IS NULL
    AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
        AND ($5::text[] IS NULL OR TRIM(UPPER(op."nomeConsorcio")) = ANY($5))
    AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric)
    AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
    ) 
`;

  private pendentes_25 = `
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

  private pendentes_24 = `
UNION ALL

SELECT DISTINCT
DATE(it."dataOrdem") AS dataPagamento,
  uu."fullName" nome,
    uu.email,
    uu."bankCode" as "codBanco",
      bc.name AS "nomeBanco",
        uu."cpfCnpj",
          it."nomeConsorcio" AS consorcio,
            it."valor" AS valor,
              uu.id,
              'Pendente' AS status,
                NULL:: boolean
from item_transacao it 
        left join public.user uu on uu."permitCode" = it."idOperadora"
        JOIN bank bc on bc.code = uu."bankCode"
        where it."dataOrdem" BETWEEN $1 AND $2
        and it."nomeConsorcio" in ('STPC', 'STPL', 'TEC')
AND($5:: integer[] IS NULL OR uu."id" = ANY($5:: integer[]))
AND(
  ($6:: numeric IS NULL OR it."valor" >= $6:: numeric)
AND($7:: numeric IS NULL OR it."valor" <= $7:: numeric)
       )
        and not exists
  (
    select 1 from detalhe_a da 
                      where da."itemTransacaoAgrupadoId" = it."itemTransacaoAgrupadoId"
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

    const initialYear = safeFilter.dataInicio.getFullYear();
    const finalYear = safeFilter.dataFim.getFullYear();
    const queryDecision = this.getQueryByYear(initialYear, finalYear);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      let allResults: any[] = [];

      if (queryDecision.requiresMerge) {
        // 1) 2024 (sem alterações significativas)
        const params2024 = this.getParametersByQuery(2024, { ...safeFilter });
        let query2024 = this.queryOlderReport;
        if (safeFilter.todosVanzeiros) query2024 += ` ${this.notCpf2024}`;
        if (safeFilter.desativados) query2024 += ` AND pu.bloqueado = true`;
        if (safeFilter.pendentes) query2024 += this.pendentes_24;
        if (safeFilter.eleicao && initialYear === 2024) {
          query2024 = query2024.replace(
            '/* extra joins */',
            `INNER JOIN ordem_pagamento_unico opu ON opu."operadoraCpfCnpj" = cf."cpfCnpj"`
          );
          query2024 += ` AND ita."idOrdemPagamento" LIKE '%U%'`;
        } else if (initialYear === 2024) {
          query2024 += ` AND ita."idOrdemPagamento" NOT LIKE '%U%'`;
        }
        const res2024 = await queryRunner.query(query2024, params2024);

        // 2) 2025+ (prepend WITH)
        const params2025 = this.getParametersByQuery(2025, { ...safeFilter });

        let query2025: string;
        if (this.shouldUnionCadeiaAndNoCadeia(safeFilter)) {
          query2025 = `(${this.queryNewReport}) UNION ALL (${this.queryNewReportNoCadeia})`;
        } else {
          const useCadeia = this.shouldUseCadeia(safeFilter);
          query2025 = useCadeia ? this.queryNewReport : this.queryNewReportNoCadeia;
        }

        if (safeFilter.todosVanzeiros) query2025 += ` ${this.notCpf2025}`;
        if (safeFilter.eleicao && finalYear >= 2025) {
          query2025 = this.eleicao2025;
        }
        if (safeFilter.pendentes) query2025 += this.pendentes_25;

        if (safeFilter.pendenciaPaga) {
          query2025 = `${query2025} UNION ALL ${this.pendenciasPagasSQL} UNION ALL ${this.pendenciasPagasEstRejSQL}`;
        }

        if (safeFilter.desativados) query2025 += ` AND pu.bloqueado = true`;

        query2025 = this.wrapWithOuterFilters(query2025);

        const res2025 = await queryRunner.query(query2025, params2025);

        allResults = [...res2024, ...res2025];
      } else {
        // single-query case
        const params = this.getParametersByQuery(initialYear, safeFilter);
        const is2025 = initialYear >= 2025;
        const is2024 = initialYear === 2024;

        let finalQuery: string;


        if (is2025) {
          // 👇 Se deve unir as duas queries (mesma regra)
          if (this.shouldUnionCadeiaAndNoCadeia(safeFilter)) {
            finalQuery = `${this.queryNewReport} UNION ALL ${this.queryNewReportNoCadeia}`;
          } else {
            const useCadeiaSingle = this.shouldUseCadeia(safeFilter);
            finalQuery = useCadeiaSingle ? this.queryNewReport : this.queryNewReportNoCadeia;
          }
          if (safeFilter.todosVanzeiros) finalQuery += ` ${this.notCpf2025}`;
          if (safeFilter.eleicao) finalQuery = this.eleicao2025;
          if (safeFilter.pendentes) finalQuery += this.pendentes_25;
          if (safeFilter.pendenciaPaga) {
            finalQuery = `${finalQuery} UNION ALL ${this.pendenciasPagasSQL} UNION ALL ${this.pendenciasPagasEstRejSQL}`;
          }
          if (safeFilter.desativados) finalQuery += ` AND pu.bloqueado = true`;

            if(safeFilter.pendenciaPaga){
              finalQuery = this.prependWithIfNeeded(finalQuery);
          } else {

            finalQuery = this.wrapWithOuterFilters(finalQuery);
          }
        } else {
          finalQuery = queryDecision.query;

          if (safeFilter.todosVanzeiros) finalQuery += is2025 ? ` ${this.notCpf2025}` : ` ${this.notCpf2024}`;
          if (is2024 && safeFilter.eleicao) {
            finalQuery = finalQuery.replace(
              '/* extra joins */',
              `INNER JOIN ordem_pagamento_unico opu ON opu."operadoraCpfCnpj" = cf."cpfCnpj"`
            );
            finalQuery += ` AND ita."idOrdemPagamento" LIKE '%U%'`;
          } else if (is2024) {
            finalQuery += ` AND ita."idOrdemPagamento" NOT LIKE '%U%'`;
          }


          if (safeFilter.pendentes && is2025) finalQuery += this.pendentes_25;
          if (safeFilter.pendentes && is2024) finalQuery += this.pendentes_24;

          if (safeFilter.pendenciaPaga && is2025) {
            finalQuery = `${finalQuery} UNION ALL ${this.pendenciasPagasSQL} UNION ALL ${this.pendenciasPagasEstRejSQL}`;
            finalQuery = this.prependWithIfNeeded(finalQuery);
          }
        }

        allResults = await queryRunner.query(finalQuery, params);
      }


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

  private wrapWithOuterFilters(query: string): string {
    const inner = this.prependWithIfNeeded(query);
    return `
SELECT *
FROM (
${inner}
) t
WHERE
     ($5::text[] IS NULL OR TRIM(UPPER(t."nomeConsorcio")) = ANY($5))

`;
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

  private getQueryByYear(initialYear: number, finalYear: number): { requiresMerge: true } | { requiresMerge: false; query: string } {
    const olderYearLimit = 2024;
    const newerYearStart = 2025;

    if (initialYear <= olderYearLimit && finalYear >= newerYearStart) return { requiresMerge: true };
    if (initialYear <= olderYearLimit && finalYear <= olderYearLimit) return { requiresMerge: false, query: this.queryOlderReport };
    if (initialYear >= newerYearStart && finalYear >= newerYearStart) return { requiresMerge: false, query: this.queryNewReport };
    return { requiresMerge: true };
  }


  private getParametersByQuery(year: number, filter: IFindPublicacaoRelatorioNovoFinancialMovement): any[] {
    let consorcioNome: string[] | null = filter.consorcioNome
      ? filter.consorcioNome.map(n => n.toUpperCase().trim())
      : null;

    // const modaisEspeciais = ['STPC', 'STPL', 'TEC'];

    // console.log(consorcioNome)
    const dataInicio = filter.dataInicio || null;
    const dataFim = filter.dataFim || null;
    const userIds = filter.userIds || null;
    const valorMin = filter.valorMin || null;
    const valorMax = filter.valorMax || null;

    if (filter.pendentes && (!consorcioNome || consorcioNome.length === 0)) {
      consorcioNome = ['STPC', 'STPL', 'TEC'];
    }

    if (year === 2024) {
      return [
        dataInicio,
        dataFim,
        this.getStatusParaFiltro(filter) || null,
        consorcioNome,
        userIds,
        valorMin,
        valorMax
      ];
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
