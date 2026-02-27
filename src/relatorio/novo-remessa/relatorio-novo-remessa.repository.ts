import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { formatDateISODate } from 'src/utils/date-utils';
import { RelatorioSinteticoNovoRemessaConsorcio, RelatorioSinteticoNovoRemessaDia, RelatorioSinteticoNovoRemessaDto, RelatorioSinteticoNovoRemessaFavorecido } from '../dtos/relatorio-sintetico-novo-remessa.dto';


@Injectable()
export class RelatorioNovoRemessaRepository {

  private static readonly QUERY_FROM = ` from ordem_pagamento op 
                    inner join ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId"=opa.id
                    inner join ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa.id
                    inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id
                    inner join public."user" uu on uu."id"=op."userId" 
                   `;

  //   private static readonly QUERY_FROM_24 = `    from
  //                     transacao_agrupado ta
  //                     inner join item_transacao_agrupado ita on ita."transacaoAgrupadoId" = ta."id"
  //                     inner join detalhe_a da on da."itemTransacaoAgrupadoId" = ita.id
  //                     inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
  //                     inner join arquivo_publicacao ap on ap."itemTransacaoId" = it.id
  //                         inner join header_lote hl on hl."id" = da."headerLoteId"
  // inner join header_arquivo ha on ha."id" = hl."headerArquivoId"
  //                     where (1=1) `;

  //   private static readonly USER_FROM_24 = `    from
  //     item_transacao_agrupado ita
  //     INNER JOIN detalhe_a da ON da."itemTransacaoAgrupadoId" = ita.id
  //     INNER JOIN item_transacao it ON it."itemTransacaoAgrupadoId" = ita.id
  //     INNER JOIN arquivo_publicacao ap ON ap."itemTransacaoId" = it.id
  //     inner join public."user" uu on uu."permitCode" = ita."idOperadora"
  //     inner join header_lote hl on hl."id" = da."headerLoteId"
  //     inner join header_arquivo ha on ha."id" = hl."headerArquivoId"
  //                     where (1=1) `;


  //   private static readonly ELEICAO_25 = ` FROM
  //   ordem_pagamento_agrupado opa 
  //     INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
  //     INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
  //     inner join ordem_pagamento_unico opu on opu."idOrdemPagamento" = opa.id::VARCHAR
  //     inner join public."user" pu on pu."cpfCnpj" = opu."operadoraCpfCnpj"
  // WHERE (1=1) `;

  //   private static readonly QUERY_CONSOLIDADO_VANZEIROS = `
  //        WITH latest_opah AS (
  //           SELECT DISTINCT ON (opah."ordemPagamentoAgrupadoId")
  //               opah."ordemPagamentoAgrupadoId",
  //               opah.id AS "opahId",
  //               opah."dataReferencia",
  //               opah."statusRemessa",
  //               opah."motivoStatusRemessa",
  //               opah."userBankCode",
  //               opah."userBankAgency",
  //               opah."userBankAccount",
  //               opah."userBankAccountDigit"
  //           FROM ordem_pagamento_agrupado_historico opah
  //           ORDER BY opah."ordemPagamentoAgrupadoId", opah."dataReferencia" DESC
  //       )
  //       SELECT
  //           op."userId",
  //           u."fullName",
  //           COALESCE(da."valorLancamento", SUM(op.valor)) AS "valorTotal"
  //       FROM ordem_pagamento op
  //                JOIN ordem_pagamento_agrupado opa
  //                     ON op."ordemPagamentoAgrupadoId" = opa.id
  //                JOIN latest_opah l
  //                     ON l."ordemPagamentoAgrupadoId" = opa.id
  //                JOIN "user" u
  //                     ON u.id = op."userId"
  //                LEFT JOIN detalhe_a da
  //                          ON da."ordemPagamentoAgrupadoHistoricoId" = l."opahId"
  //       WHERE 1 = 1
  //         AND (op."userId" = ANY($1) OR $1 IS NULL)
  //         AND (
  //           (
  //               (date_trunc('day', op."dataCaptura") BETWEEN $2 AND $3 OR $2 IS NULL OR $3 IS NULL)
  //                   AND l."statusRemessa" NOT IN (2, 3, 4)
  //               )
  //               OR
  //           (
  //               (date_trunc('day', da."dataVencimento") BETWEEN $2 AND $3 OR $2 IS NULL OR $3 IS NULL)
  //                   AND l."statusRemessa" IN (2, 3, 4)
  //               )
  //           )

  //           /* statusRemessa array filter */
  //         AND (
  //             l."statusRemessa" = ANY($4)
  //             OR (l."statusRemessa" IS NULL AND 1 = ANY($4))
  //             OR $4 IS NULL
  //         )

  //           /* Exclude certain CPF/CNPJ */
  //         AND u."cpfCnpj" NOT IN (
  //                                 '18201378000119',
  //                                 '12464869000176',
  //                                 '12464539000180',
  //                                 '12464553000184',
  //                                 '44520687000161',
  //                                 '12464577000133'
  //           )
  //       GROUP BY
  //           op."userId",
  //           u."fullName",
  //           da."valorLancamento"
  //       HAVING
  //           (SUM(op.valor) >= $5 OR $5 IS NULL)
  //          AND (SUM(op.valor) <= $6 OR $6 IS NULL)
  //       ORDER BY
  //           u."fullName";

  //   `;

  private static readonly QUERY_CONSOLIDADO_CONSORCIOS = `
      WITH latest_opah AS (
          SELECT DISTINCT ON (opah."ordemPagamentoAgrupadoId")
              opah."ordemPagamentoAgrupadoId" AS "opaId",
              opah.id                         AS "opahId",
              opah."dataReferencia",
              opah."statusRemessa",
              opah."motivoStatusRemessa",
              opah."userBankCode",
              opah."userBankAgency",
              opah."userBankAccount",
              opah."userBankAccountDigit"
          FROM ordem_pagamento_agrupado_historico opah
          ORDER BY opah."ordemPagamentoAgrupadoId", opah."dataReferencia" DESC
      ),

           valid_aggregators AS (
               SELECT DISTINCT op."ordemPagamentoAgrupadoId" AS "opaId"
               FROM ordem_pagamento op
                        JOIN latest_opah l
                             ON l."opaId" = op."ordemPagamentoAgrupadoId"
                        LEFT JOIN detalhe_a da
                                  ON da."ordemPagamentoAgrupadoHistoricoId" = l."opahId"
               WHERE
                   (
                       (
                           (date_trunc('day', op."dataCaptura") BETWEEN $1 AND $2 OR $1 IS NULL OR $2 IS NULL)
                               AND l."statusRemessa" NOT IN (2, 3, 4)
                           )
                           OR
                       (
                           (date_trunc('day', da."dataVencimento") BETWEEN $1 AND $2 OR $1 IS NULL OR $2 IS NULL)
                               AND l."statusRemessa" IN (2, 3, 4)
                           )
                       )
                 AND (
                       l."statusRemessa" = ANY($3)
                       OR (l."statusRemessa" IS NULL AND 1 = ANY($3))
                       OR $3 IS NULL
                   )
           ),

           not_tec AS (
               SELECT
                   sub."fullName",
                   SUM(COALESCE(da."valorLancamento", sub.sum_valor)) AS "valorTotal"
               FROM (
                        SELECT
                            op."ordemPagamentoAgrupadoId" AS "opaId",
                            op."nomeConsorcio"           AS "fullName",
                            SUM(op.valor)                AS sum_valor
                        FROM ordem_pagamento op
                                 JOIN "user" u ON u.id = op."userId"
                        WHERE op."nomeConsorcio" NOT IN ('STPC', 'STPL', 'TEC')
                        GROUP BY op."ordemPagamentoAgrupadoId", op."nomeConsorcio"
                    ) sub
                        JOIN valid_aggregators va
                             ON va."opaId" = sub."opaId"
                        JOIN ordem_pagamento_agrupado opa
                             ON opa.id = sub."opaId"
                        JOIN latest_opah l
                             ON l."opaId" = opa.id
                        LEFT JOIN detalhe_a da
                                  ON da."ordemPagamentoAgrupadoHistoricoId" = l."opahId"
               WHERE
                   (
                       TRIM(UPPER(sub."fullName")) = ANY($4)
                           OR $4 IS NULL
                       )
               GROUP BY sub."fullName"
               HAVING
                   (SUM(COALESCE(da."valorLancamento", sub.sum_valor)) >= $5 OR $5 IS NULL)
                  AND
                   (SUM(COALESCE(da."valorLancamento", sub.sum_valor)) <= $6 OR $6 IS NULL)
           ),

           tec AS (
               SELECT SUM("valorTotal") AS "valorTotal", "fullName"
                   FROM (
                            SELECT distinct
                                op."nomeConsorcio" AS "fullName",
                                COALESCE(da."valorLancamento", opa."valorTotal") AS "valorTotal",
                                opa.id AS "ordemPagamentoAgrupadoId"
                            FROM ordem_pagamento op
                                     JOIN valid_aggregators va
                                          ON va."opaId" = op."ordemPagamentoAgrupadoId"
                                     JOIN "user" u
                                          ON op."userId" = u.id
                                     JOIN ordem_pagamento_agrupado opa
                                          ON op."ordemPagamentoAgrupadoId" = opa.id
                                     JOIN latest_opah l
                                          ON l."opaId" = opa.id
                                     LEFT JOIN detalhe_a da
                                               ON da."ordemPagamentoAgrupadoHistoricoId" = l."opahId"
                            WHERE
                                op."nomeConsorcio" IN ('STPC', 'STPL', 'TEC')
                              AND (
                                TRIM(UPPER(op."nomeConsorcio")) = ANY($4)
                                    OR $4 IS NULL
                                )
                              AND
                                ( (COALESCE(da."valorLancamento", opa."valorTotal") >= $5 OR $5 IS NULL)
                                      AND
                                  COALESCE(da."valorLancamento", opa."valorTotal") <= $6 OR $6 IS NULL)
                   ) aux  
                   GROUP BY "fullName"
           )

      SELECT "fullName", "valorTotal"
      FROM not_tec
      UNION
      SELECT "fullName", "valorTotal"
      FROM tec
      ORDER BY "fullName";
  `;

  private static readonly QUERY_SINTETICO_VANZEIROS = `
      select distinct op."userId", date_trunc('day', op."dataCaptura") as "dataCaptura",
             u."fullName" as "nomeFavorecido", coalesce(da."dataVencimento", opa."dataPagamento") as "dataPagamento", 
             op.valor, da."valorLancamento" as "valorPagamento",
             CASE opah."statusRemessa"
                 WHEN 1 THEN 'A pagar'   
                 WHEN 2 THEN 'Aguardando Pagamento'
                 WHEN 3 THEN 'Pago'
                 WHEN 4 THEN 'Não Pago'
             END as status,
            op."nomeConsorcio",
            da.id "idDetalheA"
      from ordem_pagamento op
               inner join public.ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId" = opa.id
               join lateral (
          select opah.id,
                 opah."dataReferencia",
                 opah."statusRemessa",
                 opah."motivoStatusRemessa",
                 opah."ordemPagamentoAgrupadoId",
                 opah."userBankCode",
                 opah."userBankAgency",
                 opah."userBankAccount",
                 opah."userBankAccountDigit"
          from ordem_pagamento_agrupado_historico opah
          where opa.id = opah."ordemPagamentoAgrupadoId"
            and opah."dataReferencia" = (select max("dataReferencia") from ordem_pagamento_agrupado_historico where "ordemPagamentoAgrupadoId" = opa.id)
          ) opah on opah."ordemPagamentoAgrupadoId" = opa.id
               inner join "user" u on op."userId" = u.id
          left join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = opah.id
          where 1 = 1
          and ("userId" = any($1) or $1 is null)
          and (date_trunc('day', op."dataCaptura") BETWEEN $2 and $3 or $2 is null or $3 is null)
          and ("statusRemessa" = any($4) or $4 is null)
          and ("statusRemessa" not in (2, 3, 4))
          and u."cpfCnpj" not in ('18201378000119',
                                  '12464869000176',
                                  '12464539000180',
                                  '12464553000184',
                                  '44520687000161',
                                  '12464577000133')         
          and (op.valor >= $5 or $5 is null)
          and (op.valor <= $6 or $6 is null)
   
      union

      select distinct op."userId", date_trunc('day', op."dataCaptura") as "dataCaptura", 
             u."fullName" as "nomeFavorecido", coalesce(da."dataVencimento", opa."dataPagamento") as "dataPagamento",
             op.valor, da."valorLancamento" as "valorPagamento",
             CASE opah."statusRemessa"
                 WHEN 1 THEN 'A pagar'
                 WHEN 2 THEN 'Aguardando Pagamento'
                 WHEN 3 THEN 'Pago'
                 WHEN 4 THEN 'Não Pago'
             END as status,
             op."nomeConsorcio",
             da.id "idDetalheA"
      from ordem_pagamento op
               inner join public.ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId" = opa.id
               join lateral (
          select opah.id,
                 opah."dataReferencia",
                 opah."statusRemessa",
                 opah."motivoStatusRemessa",
                 opah."ordemPagamentoAgrupadoId",
                 opah."userBankCode",
                 opah."userBankAgency",
                 opah."userBankAccount",
                 opah."userBankAccountDigit"
          from ordem_pagamento_agrupado_historico opah
          where opa.id = opah."ordemPagamentoAgrupadoId"
            and opah."dataReferencia" = (select max("dataReferencia") from ordem_pagamento_agrupado_historico where "ordemPagamentoAgrupadoId" = opa.id)
          ) opah on opah."ordemPagamentoAgrupadoId" = opa.id
               inner join "user" u on op."userId" = u.id
               inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = opah.id
      where 1 = 1
        and ("userId" = any($1) or $1 is null)
        and (date_trunc('day', da."dataVencimento") BETWEEN $2 and $3 or $2 is null or $3 is null)
        and ("statusRemessa" = any($4) or $4 is null)
        and ("statusRemessa" in (2, 3, 4))
        and u."cpfCnpj" not in ('18201378000119',
                                '12464869000176',
                                '12464539000180',
                                '12464553000184',
                                '44520687000161',
                                '12464577000133')
        and (da."valorLancamento" >= $5 or $5 is null)
        and (da."valorLancamento" <= $6 or $6 is null)
      order by "nomeConsorcio", "nomeFavorecido", "dataCaptura"
      `;

  private static readonly QUERY_SINTETICO_CONSORCIOS = `
      select distinct op."userId", date_trunc('day', op."dataCaptura") as "dataCaptura",
             u."fullName" as "nomeFavorecido", coalesce(da."dataVencimento", opa."dataPagamento") as "dataPagamento", 
             op.valor, da."valorLancamento" as "valorPagamento",
             CASE opah."statusRemessa"
                 WHEN 1 THEN 'A pagar'   
                 WHEN 2 THEN 'Aguardando Pagamento'
                 WHEN 3 THEN 'Pago'
                 WHEN 4 THEN 'Não Pago'
             END as status,
             op."nomeConsorcio",
             da.id "idDetalheA"
      from ordem_pagamento op
               left join public.ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId" = opa.id
               left join lateral (
          select opah.id,
                 opah."dataReferencia",
                 opah."statusRemessa",
                 opah."motivoStatusRemessa",
                 opah."ordemPagamentoAgrupadoId",
                 opah."userBankCode",
                 opah."userBankAgency",
                 opah."userBankAccount",
                 opah."userBankAccountDigit"
          from ordem_pagamento_agrupado_historico opah
          where opa.id = opah."ordemPagamentoAgrupadoId"
            and opah."dataReferencia" = (select max("dataReferencia") from ordem_pagamento_agrupado_historico where "ordemPagamentoAgrupadoId" = opa.id)
          ) opah on opah."ordemPagamentoAgrupadoId" = opa.id
               inner join "user" u on op."userId" = u.id
          left join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = opah.id
          where 1 = 1
            and (trim(upper("nomeConsorcio")) = any($1) or $1 is null)
            and (date_trunc('day', op."dataCaptura") BETWEEN $2 and $3 or $2 is null or $3 is null)
            and ("statusRemessa" = any($4) or $4 is null)
            and ("statusRemessa" not in (2, 3, 4))
            and (op."nomeConsorcio" not in ('STPC', 'STPL', 'TEC'))    
            and (op.valor >= $5 or $5 is null)
            and (op.valor <= $6 or $6 is null)
   
      union

      select distinct op."userId", date_trunc('day', op."dataCaptura") as "dataCaptura", 
             u."fullName" as "nomeFavorecido", coalesce(da."dataVencimento", opa."dataPagamento") as "dataPagamento",
             op.valor, da."valorLancamento" as "valorPagamento",
             CASE opah."statusRemessa"
                 WHEN 1 THEN 'A pagar'
                 WHEN 2 THEN 'Aguardando Pagamento'
                 WHEN 3 THEN 'Pago'
                 WHEN 4 THEN 'Não Pago'
             END as status,
             op."nomeConsorcio",
             da.id "idDetalheA"
      from ordem_pagamento op
               inner join public.ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId" = opa.id
               join lateral (
          select opah.id,
                 opah."dataReferencia",
                 opah."statusRemessa",
                 opah."motivoStatusRemessa",
                 opah."ordemPagamentoAgrupadoId",
                 opah."userBankCode",
                 opah."userBankAgency",
                 opah."userBankAccount",
                 opah."userBankAccountDigit"
          from ordem_pagamento_agrupado_historico opah
          where opa.id = opah."ordemPagamentoAgrupadoId"
            and opah."dataReferencia" = (select max("dataReferencia") from ordem_pagamento_agrupado_historico where "ordemPagamentoAgrupadoId" = opa.id)
          ) opah on opah."ordemPagamentoAgrupadoId" = opa.id
               inner join "user" u on op."userId" = u.id
               inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = opah.id
      where 1 = 1
        and (trim(upper("nomeConsorcio")) = any($1) or $1 is null)
        and (date_trunc('day', da."dataVencimento") BETWEEN $2 and $3 or $2 is null or $3 is null)
        and ("statusRemessa" = any($4) or $4 is null)
        and ("statusRemessa" in (2, 3, 4))
        and (op."nomeConsorcio" not in ('STPC', 'STPL', 'TEC'))
        and (da."valorLancamento" >= $5 or $5 is null)
        and (da."valorLancamento" <= $6 or $6 is null)
      order by "nomeConsorcio", "nomeFavorecido", "dataCaptura"
      `;

  private readonly pendentes_25 = `
SELECT
  DATE(op."dataOrdem") AS dataPagamento,
  op."nomeOperadora" as nome,
  op."valor" AS valor,
  pu."bankCode"
FROM ordem_pagamento op
INNER JOIN public."user" pu ON pu.id = op."userId"
WHERE
    op."dataOrdem" BETWEEN $1  AND $2 
    AND op."ordemPagamentoAgrupadoId" IS NULL
    AND pu."bankAccount" IS NOT NULL
    AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
    AND op."nomeConsorcio" IN ('SPTC', 'STPL', 'TEC')
    AND (
          ($4::numeric IS NULL OR op."valor" >= $4::numeric) 
          AND ($5::numeric IS NULL OR op."valor" <= $5::numeric)
      )
`
  private readonly pendentes_25_consorcio = `
SELECT
  DATE(op."dataOrdem") AS dataPagamento,
  op."nomeOperadora",

            CASE
                               WHEN pu."permitCode" = '8' THEN 'VLT'
                WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                ELSE op."nomeConsorcio"
                            END AS "nome",
  op."valor" AS valor,
  pu."bankCode"
FROM ordem_pagamento op
INNER JOIN public."user" pu ON pu.id = op."userId"
WHERE
    op."dataOrdem" BETWEEN $1  AND $2 
    AND op."ordemPagamentoAgrupadoId" IS NULL
    AND pu."bankAccount" IS NOT NULL
    AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
     AND op."nomeConsorcio" = ANY(
          COALESCE(NULLIF($6::text[], '{}'), ARRAY['STPC','STPL','TEC'])
    )
    AND (
          ($4::numeric IS NULL OR op."valor" >= $4::numeric) 
          AND ($5::numeric IS NULL OR op."valor" <= $5::numeric)
      )
`

  private pendentes_24 = `
SELECT DISTINCT 
    DATE(it."dataOrdem") AS dataPagamento,
    uu."fullName" nome,
    it."valor" AS valor,
    uu."bankCode" as "codBanco" 
from item_transacao it 
        left join public.user uu on uu."permitCode"=it."idOperadora"
		    JOIN bank bc on bc.code = uu."bankCode"
        where it."dataOrdem" BETWEEN $1 AND $2
        and it."nomeConsorcio" in('STPC','STPL','TEC')
		    and it."idOrdemPagamento" <> 'PU04'
        AND ($3::integer[] IS NULL OR uu."id" = ANY($3::integer[]))
        AND (
          ($4::numeric IS NULL OR it."valor" >= $4::numeric) 
          AND ($5::numeric IS NULL OR it."valor" <= $5::numeric)
        )
        and not exists
          (
            select 1 from detalhe_a da 
                      where da."itemTransacaoAgrupadoId"=it."itemTransacaoAgrupadoId"
          )
      and not exists (
			  select 1 from item_transacao itt
			  inner join item_transacao_agrupado ita on itt."itemTransacaoAgrupadoId" = ita."id"
  			inner join detalhe_a da on da."itemTransacaoAgrupadoId" = ita.id	
		    where itt."dataOrdem" = it."dataOrdem"
			  and itt."idOrdemPagamento" = it."idOrdemPagamento"
			  and itt."idOperadora" = it."idOperadora"
		)
`

  private readonly WITH_AS = `
  WITH RECURSIVE

pendencia AS (
  SELECT DISTINCT opaa.id, oph."dataReferencia"
  FROM ordem_pagamento_agrupado opaa
  INNER JOIN ordem_pagamento_agrupado_historico oph 
      ON oph."ordemPagamentoAgrupadoId" = opaa.id
  INNER JOIN detalhe_a daa 
      ON daa."ordemPagamentoAgrupadoHistoricoId" = oph.id
  WHERE daa."dataVencimento" BETWEEN '%DATA_INICIO%' AND '%DATA_FIM%'
    AND EXISTS (
      SELECT 1 FROM ordem_pagamento_agrupado opa2 WHERE opa2."ordemPagamentoAgrupadoId" = opaa.id
    )
),

cadeia_pagamento (ordem_id, pai_id, raiz_id) AS (
  SELECT opa.id, opa."ordemPagamentoAgrupadoId", opa.id
  FROM ordem_pagamento_agrupado opa
    where opa."dataPagamento" BETWEEN '%DATA_INICIO%' AND '%DATA_FIM%' 
  UNION ALL

  SELECT filho.id, filho."ordemPagamentoAgrupadoId", pai.raiz_id
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

  private readonly pendenciaPagaSQL = `
SELECT DISTINCT
  da.id,
  da."dataVencimento",
  uu."fullName",
  oph."statusRemessa",
  uu."permitCode",
  oph."motivoStatusRemessa",
  CASE
    WHEN uu."permitCode" = '8' THEN 'VLT'
    WHEN uu."permitCode" LIKE '4%' THEN 'STPC'
    WHEN uu."permitCode" LIKE '81%' THEN 'STPL'
    WHEN uu."permitCode" LIKE '7%' THEN 'TEC'
    ELSE op."nomeConsorcio"
  END AS "nome",
   da."valorLancamento" AS valor,
  uu."bankAccount"
 from ordem_pagamento op
                  INNER JOIN ordem_pagamento_agrupado opa ON opa.id = op."ordemPagamentoAgrupadoId"
INNER JOIN cadeia_pagamento cp ON cp.ordem_id = opa.id
INNER JOIN ordem_pagamento_agrupado op_pai ON op_pai.id = cp.raiz_id
INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = op_pai.id
INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
INNER JOIN public."user" uu ON uu.id = op."userId"
INNER JOIN bank bc ON bc.code = uu."bankCode"
WHERE da."dataVencimento" BETWEEN '%DATA_INICIO%' AND '%DATA_FIM%'
  AND oph."statusRemessa" = 5
  AND (oph."motivoStatusRemessa" NOT IN ('AM') OR oph."motivoStatusRemessa" IS NULL)
 %FILTRO_USER%
 %FILTRO_CONSORCIO%
   %FILTRO_VALOR_MIN%
   %FILTRO_VALOR_MAX%
`;

  private readonly pendenciaPagaEstRejSQL = `
SELECT DISTINCT
    da.id,
    oph."dataReferencia" AS "dataVencimento",
    uu."fullName",
    oph."statusRemessa",
    uu."permitCode",
    oph."motivoStatusRemessa",
    CASE
        WHEN uu."permitCode" = '8' THEN 'VLT'
        WHEN uu."permitCode" LIKE '4%' THEN 'STPC'
        WHEN uu."permitCode" LIKE '81%' THEN 'STPL'
        WHEN uu."permitCode" LIKE '7%' THEN 'TEC'
        ELSE op."nomeConsorcio"
    END AS "nome",
    CASE
      WHEN oph."statusRemessa" = 5 THEN ROUND(COALESCE(opa."valorTotal", da."valorLancamento"), 3)
      ELSE da."valorLancamento"
    END AS valor,
    uu."bankAccount"
FROM ordem_pagamento op
  INNER JOIN ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId"=opa.id
  INNER JOIN ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa.id
  INNER JOIN pendencia pd on opa."ordemPagamentoAgrupadoId" = pd.id
  LEFT JOIN detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id
  LEFT JOIN public."user" uu on uu."id"=op."userId"
WHERE
    oph."statusRemessa" = 5
    AND pd."dataReferencia" BETWEEN '%DATA_INICIO%' AND '%DATA_FIM%'
    AND (oph."motivoStatusRemessa" NOT IN ('AM') OR oph."motivoStatusRemessa" IS NULL)
   %FILTRO_USER%
   %FILTRO_CONSORCIO%
     %FILTRO_VALOR_MIN%
     %FILTRO_VALOR_MAX%
`;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }
  private logger = new CustomLogger(RelatorioNovoRemessaRepository.name, { timestamp: true });

  public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      let allResults: any[] = [];
      const onlyPendentes =
        !!filter.pendentes &&
        !filter.pago &&
        !filter.aPagar &&
        !filter.emProcessamento &&
        !filter.erro &&
        !filter.estorno &&
        !filter.rejeitado &&
        !filter.pendenciaPaga;

      if (onlyPendentes) {
        allResults = await this.pendentesQuery(filter, queryRunner);
      } else {

        // Build queries for vanzeiros
        let sqlVanzeiros = '';
        if (filter.todosVanzeiros || filter.userIds) {
          sqlVanzeiros = this.consultaVanzeiros(filter);
        }

        // Build queries for consorcios
        let sqlConsorcios = '';
        if (filter.todosConsorcios || filter.consorcioNome) {
          sqlConsorcios = this.consultaConsorcios(filter);
        }

        // Combine queries
        let sql = '';
        if (sqlVanzeiros && sqlConsorcios) {
          sql = `${sqlVanzeiros} UNION ALL ${sqlConsorcios}`;
        } else if (sqlVanzeiros) {
          sql = sqlVanzeiros;
        } else if (sqlConsorcios) {
          sql = sqlConsorcios;
        }

        if (sql) {
          const finalQuery = `SELECT nome, SUM(valor) AS valor FROM (${sql}) AS combined GROUP BY nome`;
          allResults = await queryRunner.query(finalQuery);
        }

        // Add pendentes if filter is active
        if (filter.pendentes) {
          const pendentesResults = await this.pendentesQuery(filter, queryRunner);
          allResults = [...allResults, ...pendentesResults];
        }
      }

      const count = allResults.length;
      const valorTotal = allResults.reduce((acc, r) => acc + Number(r.valor), 0);

      const relatorioConsolidadoDto = new RelatorioConsolidadoNovoRemessaDto();
      relatorioConsolidadoDto.valor = parseFloat(valorTotal.toFixed(2));
      relatorioConsolidadoDto.count = count;

      relatorioConsolidadoDto.data = allResults.map((r) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = r.nome;
        elem.valor = parseFloat(r.valor);
        return elem;
      });

      return relatorioConsolidadoDto;
    } finally {
      await queryRunner.release();
    }
  }
  public async findSintetico(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioSinteticoNovoRemessaDto> {
    if (filter.consorcioNome) {

      filter.consorcioNome = filter.consorcioNome.map((c) => { return c.toUpperCase().trim(); });

    }

    const parametersQueryVanzeiros = [filter.userIds || null, filter.dataInicio || null, filter.dataFim || null, this.getStatusParaFiltro(filter), filter.valorMin || null, filter.valorMax || null];

    const parametersQueryConsorciosEModais = [filter.consorcioNome || null, filter.dataInicio || null, filter.dataFim || null, this.getStatusParaFiltro(filter), filter.valorMin || null, filter.valorMax || null];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = [];
    let resultConsorciosEModais: any[] = [];
    let resultVanzeiros: any[] = [];

    const mapModaisEConsorcios = await this.obterTotalConsorciosEModais(filter, queryRunner);

    if (filter.todosVanzeiros) {
      filter.userIds = undefined;
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_VANZEIROS, parametersQueryVanzeiros);
    }

    if (filter.todosConsorcios) {
      filter.consorcioNome = undefined;
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    if (filter.userIds && filter.userIds.length > 0) {
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_VANZEIROS, parametersQueryVanzeiros);
    }

    if (filter.consorcioNome && filter.consorcioNome.length > 0) {
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    // Nenhum critério, trás todos.
    if (!filter.todosVanzeiros && !filter.todosConsorcios && (!filter.userIds || filter.userIds.length == 0) && (!filter.consorcioNome || filter.consorcioNome.length == 0)) {
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_VANZEIROS, parametersQueryVanzeiros);
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    result = resultVanzeiros.concat(resultConsorciosEModais);

    await queryRunner.release();
    const count = result.length;

    const relatorioSinteticoNovoRemessaDto = new RelatorioSinteticoNovoRemessaDto();
    relatorioSinteticoNovoRemessaDto.count = count;

    const elems: RelatorioSinteticoNovoRemessaDia[] = [];
    result.forEach((r) => {
      const elem = new RelatorioSinteticoNovoRemessaDia();
      elem.userId = r.userId;
      elem.dataCaptura = r.dataCaptura;
      elem.nomeFavorecido = r.nomeFavorecido;
      elem.dataPagamento = r.dataPagamento;
      elem.valorPagamento = r.valor;
      elem.status = r.status;
      elem.nomeConsorcio = r.nomeConsorcio;
      elems.push(elem);
    });

    // agrupa por consorcio
    const agrupamentoConsorcio = elems.reduce((acc, curr) => {
      if (!acc[curr.nomeConsorcio]) {
        acc[curr.nomeConsorcio] = [];
      }
      acc[curr.nomeConsorcio].push(curr);
      return acc;
    }, {});

    relatorioSinteticoNovoRemessaDto.agrupamentoConsorcio = [];

    for (const consorcio in agrupamentoConsorcio) {
      const agrupamentoFavorecido = agrupamentoConsorcio[consorcio].reduce((acc, curr) => {
        if (!acc[curr.nomeFavorecido]) {
          acc[curr.nomeFavorecido] = [];
        }
        acc[curr.nomeFavorecido].push(curr);
        return acc;
      }, {});

      for (const favorecido in agrupamentoFavorecido) {
        const agrupamentoDia = agrupamentoFavorecido[favorecido];
        const subtotalFavorecido = agrupamentoDia.reduce((acc, curr) => acc + parseFloat(curr.valorPagamento), 0);
        const relatorioFavorecido = new RelatorioSinteticoNovoRemessaFavorecido();
        relatorioFavorecido.subtotalFavorecido = parseFloat(subtotalFavorecido);
        relatorioFavorecido.nomeFavorecido = favorecido;
        relatorioFavorecido.agrupamentoDia = agrupamentoDia;
        agrupamentoFavorecido[favorecido] = relatorioFavorecido;
      }
      const relatorioConsorcio = new RelatorioSinteticoNovoRemessaConsorcio();

      relatorioConsorcio.subtotalConsorcio = mapModaisEConsorcios[consorcio];

      relatorioConsorcio.nomeConsorcio = consorcio;
      relatorioConsorcio.agrupamentoFavorecido = Object.values(agrupamentoFavorecido);

      relatorioSinteticoNovoRemessaDto.agrupamentoConsorcio.push(relatorioConsorcio);
    }
    // o total geral passa a ser o total dos consorcios
    relatorioSinteticoNovoRemessaDto.total = relatorioSinteticoNovoRemessaDto.agrupamentoConsorcio.reduce((acc, curr) => acc + curr.subtotalConsorcio, 0);
    return relatorioSinteticoNovoRemessaDto;
  }

  private async obterTotalConsorciosEModais(filter: IFindPublicacaoRelatorioNovoRemessa, queryRunner: QueryRunner) {
    /***
     No caso dos vanzeiros, há sempre uma diferença do valor total do consolidado com o valor total dos detalhes.
     Por isso, vamos buscar o consolidado e somar o consolidado.
     ***/

    const parametersQueryConsolidadoModais = [filter.dataInicio || null, filter.dataFim || null, this.getStatusParaFiltro(filter), filter.consorcioNome || null, filter.valorMin || null, filter.valorMax || null];

    const resultConsolidadoModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_CONSORCIOS, parametersQueryConsolidadoModais);
    // Cria um mapa e agrupa os valores modais
    const mapModaisEConsorcios = resultConsolidadoModais.reduce((acc, curr) => {
      if (!acc[curr.fullName]) {
        acc[curr.fullName] = 0;
      }
      acc[curr.fullName] += parseFloat(curr.valorTotal);
      return acc;
    }, {});
    return mapModaisEConsorcios;
  }

  private shouldUnionErrorsAndValid = (filter: IFindPublicacaoRelatorioNovoRemessa) => {
    const filtraStatusBase = filter.aPagar || filter.emProcessamento || filter.pago;
    const filtraPendenciaOuErro = filter.pendenciaPaga || filter.erro || filter.estorno || filter.rejeitado;
    return filtraStatusBase && filtraPendenciaOuErro;
  };

  private shouldUseErrorPath(filter: IFindPublicacaoRelatorioNovoRemessa): boolean {
    if (!filter) return false;
    if (filter.pendenciaPaga || filter.erro || filter.estorno || filter.rejeitado) return true;
    return false;
  }

  private getStatusParaFiltro(filter: IFindPublicacaoRelatorioNovoRemessa) {
    let statuses: number[] | null = null;
    if (filter.emProcessamento || filter.pago || filter.erro || filter.aPagar || filter.estorno || filter.rejeitado || filter.pendenciaPaga) {
      statuses = [];

      if (filter.aPagar) {
        statuses.push(0);
        statuses.push(1);
      }
      if (filter.emProcessamento) {
        statuses.push(2);
      }

      if (filter.pago) {
        statuses.push(3);
      }

      if (filter.erro || filter.estorno || filter.rejeitado) {
        statuses.push(4);
      }
      if (filter.pendenciaPaga) {
        statuses.push(5)
      }

    }
    return statuses;
  }
  private consultaVanzeiros(filter: IFindPublicacaoRelatorioNovoRemessa) {
    this.logger.warn(`${filter}`)
    const dataInicio = formatDateISODate(filter.dataInicio);
    const dataFim = formatDateISODate(filter.dataFim);

    let sqlOutros = '';
    let condicoesOutros = '';

    const hasStatusFilter = filter.aPagar !== undefined || filter.emProcessamento !== undefined || filter.pago !== undefined || filter.erro !== undefined || filter.estorno || filter.rejeitado;

    if (this.shouldUseErrorPath(filter)) {
      sqlOutros = `
       WITH RECURSIVE
    pendencia AS (
        SELECT DISTINCT
            opaa.id,
            oph."dataReferencia"
        FROM
            ordem_pagamento_agrupado opaa
            INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opaa.id
            INNER JOIN detalhe_a daa ON daa."ordemPagamentoAgrupadoHistoricoId" = oph.id
        WHERE
              daa."dataVencimento" BETWEEN '${dataInicio}' and '${dataFim}'
            AND EXISTS (
                SELECT 1
                FROM ordem_pagamento_agrupado opa2
                WHERE
                    opa2."ordemPagamentoAgrupadoId" = opaa.id
            )
    ),
    cadeia_pagamento (ordem_id, pai_id, raiz_id) AS (
        SELECT opa.id, opa."ordemPagamentoAgrupadoId", opa.id
        FROM ordem_pagamento_agrupado opa
            where opa."dataPagamento" BETWEEN '${dataInicio}' AND '${dataFim}' 
        UNION ALL
        SELECT filho.id, filho."ordemPagamentoAgrupadoId", pai.raiz_id
        FROM
            ordem_pagamento_agrupado filho
            INNER JOIN cadeia_pagamento pai ON filho."ordemPagamentoAgrupadoId" = pai.ordem_id
    ),
    cadeias_com_paga AS (
        SELECT DISTINCT
            cp.raiz_id
        FROM
            cadeia_pagamento cp
            INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = cp.ordem_id
        WHERE
            oph."statusRemessa" = 5
    )select distinct 
                    da.id,
                    da."dataVencimento", 
                    uu."fullName" as nome, 
                      da."valorRealEfetivado" as valor
`;
      sqlOutros += RelatorioNovoRemessaRepository.QUERY_FROM;
      sqlOutros += `INNER JOIN cadeia_pagamento cp ON cp.ordem_id = opa.id`;
    } else {
      sqlOutros = `select distinct 
                    da.id,
                    da."dataVencimento", 
                    uu."fullName" as nome, 
                      da."valorRealEfetivado" as valor
                  `;
      sqlOutros += RelatorioNovoRemessaRepository.QUERY_FROM;
    }

    condicoesOutros += ` and da."dataVencimento" BETWEEN '${dataInicio}' and '${dataFim}' 
      `;

    const statuses = this.getStatusParaFiltro(filter);

    if (hasStatusFilter && statuses) {
      condicoesOutros += ` and oph."statusRemessa" in (${statuses.join(',')})\n`;

      const has3or4 = statuses.includes(3) || statuses.includes(4);
      if (statuses.includes(4)) {
        condicoesOutros += `and oph."statusRemessa" not in (3,5)\n`;
        condicoesOutros += `AND cp.raiz_id NOT IN ( SELECT raiz_id FROM cadeias_com_paga )\n`;
      }

      if (has3or4) {
        condicoesOutros += ` and oph."motivoStatusRemessa" <> 'AM'\n`;
      }
      if (filter.estorno) {
        condicoesOutros += ` and oph."motivoStatusRemessa" IN ('02')\n`;
        condicoesOutros += `and oph."statusRemessa" not in (3,5)\n`;
        condicoesOutros += `and uu."bankAccount" IS NOT NULL\n`;
        condicoesOutros += `AND cp.raiz_id NOT IN ( SELECT raiz_id FROM cadeias_com_paga )\n`
      }
      if (filter.rejeitado) {
        condicoesOutros += ` and oph."motivoStatusRemessa" IN ('AL')\n`;
        condicoesOutros += `and oph."statusRemessa" not in (3,5)\n`;
        condicoesOutros += `and uu."bankAccount" IS NOT NULL\n`;
        condicoesOutros += `AND cp.raiz_id NOT IN ( SELECT raiz_id FROM cadeias_com_paga )\n`
      }
    }

    if (filter.pendentes && !filter.erro) {
      condicoesOutros += `and oph."statusRemessa" not in (3,5)\n`;
      condicoesOutros += `AND op."ordemPagamentoAgrupadoId" IS NULL\n`;
    }

    if (filter.valorMin !== undefined) {
      condicoesOutros += ` and da."valorRealEfetivado" >= ${filter.valorMin}`;
    }

    if (filter.valorMax !== undefined) {
      condicoesOutros += ` and da."valorRealEfetivado" <= ${filter.valorMax}`;
    }

    if (filter.userIds) {
      condicoesOutros += ` and uu.id in('${filter.userIds.join("','")}')`;
    } else if (filter.todosVanzeiros) {
      condicoesOutros += ` and op."nomeConsorcio" in('STPC','STPL','TEC')`;
    }

    const finalSQL = `${sqlOutros} ${condicoesOutros}`;
    return finalSQL;
  }

  private async pendentesQuery(
    filter: IFindPublicacaoRelatorioNovoRemessa,
    queryRunner: QueryRunner
  ) {
    let queryParams;
    if (filter.todosConsorcios || filter.consorcioNome) {
      queryParams = [filter.dataInicio, filter.dataFim, filter.userIds, filter.valorMin, filter.valorMax, filter.consorcioNome];
      const result = await queryRunner.query(`SELECT nome, NULL as "nomeConsorcio", SUM(valor) as valor
        FROM(${this.pendentes_25_consorcio}) AS r 
        GROUP BY r.nome`, queryParams);
      return result;
    } else {
      queryParams = [filter.dataInicio, filter.dataFim, filter.userIds, filter.valorMin, filter.valorMax];
      const result = await queryRunner.query(this.pendentes_25, queryParams);
      return result;
    }
  }



  private consultaConsorcios(filter: IFindPublicacaoRelatorioNovoRemessa) {
    const dataInicio = formatDateISODate(filter.dataInicio);
    const dataFim = formatDateISODate(filter.dataFim);

    const hasStatusFilter = filter.aPagar !== undefined || filter.emProcessamento !== undefined || filter.pago !== undefined || filter.erro !== undefined || filter.estorno || filter.rejeitado || filter.pendenciaPaga;
    const statuses = this.getStatusParaFiltro(filter);

    let sqlErros = '';
    let sqlPagos = '';
    let finalSQL = '';
    let condicoesOutros = ` where (1=1) and r."dataVencimento" BETWEEN '${dataInicio}' and '${dataFim}' `;

    // Build error path query (with CTEs)
    if (this.shouldUseErrorPath(filter)) {
      sqlErros = `
    WITH RECURSIVE
      pendencia AS (
        SELECT DISTINCT
          opaa.id,
          oph."dataReferencia"
        FROM
          ordem_pagamento_agrupado opaa
          INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opaa.id
          INNER JOIN detalhe_a daa ON daa."ordemPagamentoAgrupadoHistoricoId" = oph.id
        WHERE
          daa."dataVencimento" BETWEEN '${dataInicio}' and '${dataFim}'
          AND EXISTS (
            SELECT 1
            FROM ordem_pagamento_agrupado opa2
            WHERE opa2."ordemPagamentoAgrupadoId" = opaa.id
          )
      ),
      cadeia_pagamento (ordem_id, pai_id, raiz_id) AS (
        SELECT opa.id, opa."ordemPagamentoAgrupadoId", opa.id
        FROM ordem_pagamento_agrupado opa
            where opa."dataPagamento" BETWEEN '${dataInicio}' AND '${dataFim}' 
        UNION ALL
        SELECT filho.id, filho."ordemPagamentoAgrupadoId", pai.raiz_id
        FROM ordem_pagamento_agrupado filho
          INNER JOIN cadeia_pagamento pai ON filho."ordemPagamentoAgrupadoId" = pai.ordem_id
      ),
      cadeias_com_paga AS (
        SELECT DISTINCT cp.raiz_id
        FROM cadeia_pagamento cp
          INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = cp.ordem_id
        WHERE oph."statusRemessa" = 5
      )
      SELECT DISTINCT
        da.id,
        da."dataVencimento",
        uu."fullName",
        oph."statusRemessa",
        uu."permitCode",
        oph."motivoStatusRemessa",
        CASE
          WHEN uu."permitCode" = '8' THEN 'VLT'
          WHEN uu."permitCode" LIKE '4%' THEN 'STPC'
          WHEN uu."permitCode" LIKE '81%' THEN 'STPL'
          WHEN uu."permitCode" LIKE '7%' THEN 'TEC'
          ELSE op."nomeConsorcio"
        END AS "nome",
        da."valorLancamento" AS valor,
        uu."bankAccount"
          ${RelatorioNovoRemessaRepository.QUERY_FROM}
      INNER JOIN cadeia_pagamento cp ON cp.ordem_id = opa.id
      WHERE
        oph."statusRemessa" = ${filter.pendenciaPaga ? `5` : '4'}
        ${filter.pendenciaPaga ? `` : `AND oph."statusRemessa" NOT IN (3,5)`}
        AND uu."bankAccount" IS NOT NULL
       ${filter.pendenciaPaga ? ' AND cp.raiz_id IN (SELECT raiz_id FROM cadeias_com_paga)' : ' AND cp.raiz_id NOT IN (SELECT raiz_id FROM cadeias_com_paga)'}
    `;
    }

    // Build paid/valid path query (without CTEs)
    if (filter.pago || filter.aPagar || filter.emProcessamento) {
      sqlPagos = `
        SELECT distinct
        da.id,
          da."dataVencimento",
          uu."fullName",
          oph."statusRemessa",
          uu."permitCode",
          oph."motivoStatusRemessa",
            CASE
                               WHEN uu."permitCode" = '8' THEN 'VLT'
                WHEN uu."permitCode" LIKE '4%' THEN 'STPC'
                WHEN uu."permitCode" LIKE '81%' THEN 'STPL'
                WHEN uu."permitCode" LIKE '7%' THEN 'TEC'
                                ELSE op."nomeConsorcio"
                            END AS "nome",
         da."valorLancamento" as valor
        ${RelatorioNovoRemessaRepository.QUERY_FROM}
      `;
    }

    if (filter.pendenciaPaga) {
      const filtroUser = filter.userIds ? `AND uu.id IN ('${filter.userIds.join("','")}')` : '';
      const nomes = filter.consorcioNome ? filter.consorcioNome.map((n) => n.toUpperCase().trim()) : [];
      const consorciosDefault = `'STPC','STPL','TEC','VLT','Santa Cruz','Internorte','Intersul','Transcarioca','MobiRio'`;
      const nomeCase = `CASE\n    WHEN uu."permitCode" = '8' THEN 'VLT'\n    WHEN uu."permitCode" LIKE '4%' THEN 'STPC'\n    WHEN uu."permitCode" LIKE '81%' THEN 'STPL'\n    WHEN uu."permitCode" LIKE '7%' THEN 'TEC'\n    ELSE op."nomeConsorcio"\n  END`;
      const filtroConsorcio = filter.todosConsorcios
        ? `AND TRIM(UPPER(${nomeCase})) IN (${consorciosDefault})`
        : nomes.length
          ? `AND TRIM(UPPER(${nomeCase})) IN ('${nomes.join("','")}')`
          : '';
      const filtroValorMin = filter.valorMin ? `AND COALESCE(da."valorLancamento", opa."valorTotal") >= ${filter.valorMin}` : '';
      const filtroValorMax = filter.valorMax ? `AND COALESCE(da."valorLancamento", opa."valorTotal") <= ${filter.valorMax}` : '';

      const withAs = this.WITH_AS
        .replace(/%DATA_INICIO%/g, dataInicio)
        .replace(/%DATA_FIM%/g, dataFim);

      const pendenciaPaga = this.pendenciaPagaSQL
        .replace(/%DATA_INICIO%/g, dataInicio)
        .replace(/%DATA_FIM%/g, dataFim)
        .replace(/%FILTRO_USER%/g, filtroUser)
        .replace(/%FILTRO_CONSORCIO%/g, filtroConsorcio)
        .replace(/%FILTRO_VALOR_MIN%/g, filtroValorMin)
        .replace(/%FILTRO_VALOR_MAX%/g, filtroValorMax);

      // const pendenciaPagaEstRej = this.pendenciaPagaEstRejSQL
      //   .replace(/%DATA_INICIO%/g, dataInicio)
      //   .replace(/%DATA_FIM%/g, dataFim)
      //   .replace(/%FILTRO_USER%/g, filtroUser)
      //   .replace(/%FILTRO_CONSORCIO%/g, filtroConsorcio)
      //   .replace(/%FILTRO_VALOR_MIN%/g, filtroValorMin)
      //   .replace(/%FILTRO_VALOR_MAX%/g, filtroValorMax);

      const sqlOutros = `
  ${withAs}
  ${pendenciaPaga}
      `;

      finalSQL = `
        SELECT nome, NULL as "nomeConsorcio", SUM(valor) as valor
        FROM (${sqlOutros}) AS r
        GROUP BY r.nome
      `;
      return finalSQL;
    }

    // Apply filters
    if (hasStatusFilter && statuses) {
      condicoesOutros += ` and r."statusRemessa" in (${statuses.join(',')})\n`;

      const has3or4 = statuses.includes(3) || statuses.includes(4) || statuses.includes(5);

      if (has3or4) {
        condicoesOutros += ` and r."motivoStatusRemessa" <> 'AM'\n`;
      }
      if (filter.rejeitado) {
        condicoesOutros += `   AND r."motivoStatusRemessa" IN ( 'AL')`
      }
      if (filter.estorno) {
        condicoesOutros += `   AND r."motivoStatusRemessa" IN ( '02')`
      }
    }

    // Pendentes é tratado em pendentesQuery() no fluxo principal.

    if (filter.todosConsorcios) {
      const consorcios = `'STPC','STPL','VLT','Santa Cruz','Internorte','Intersul','Transcarioca','MobiRio','TEC'`;
      condicoesOutros += ` AND r."nome" IN (${consorcios}) `;
    } else if (filter.consorcioNome) {
      const nomes = `'${filter.consorcioNome.join("','")}'`;
      condicoesOutros += ` AND r."nome" IN (${nomes}) `;
    }

    // Combine queries
    let sqlOutros = '';
    if (filter.pago || filter.aPagar || filter.emProcessamento) {
      if (filter.estorno || filter.rejeitado || filter.erro) {
        sqlOutros = `${sqlErros} UNION ${sqlPagos}`
      } else {
        sqlOutros = sqlPagos
      }
    } else {
      sqlOutros = sqlErros
    }

    if (!sqlOutros || !sqlOutros.trim()) {
      return '';
    }

    finalSQL = `
        SELECT nome, NULL as "nomeConsorcio", SUM(valor) as valor
        FROM (${sqlOutros}) AS r  ${condicoesOutros}
        GROUP BY r.nome
      `;
    return finalSQL;
  }


  private somatorioTotalPagoErro(sql: string) {
    return `select sum("valor") valor from(` + sql + `) s `;
  }

  private somatorioTotalAPagar(sql: string) {
    return `select sum("valor") valor from(` + sql + `) s`;
  }
}