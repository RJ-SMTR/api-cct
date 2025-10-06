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
                    where (1=1) `;

  private static readonly QUERY_FROM_24 = `    from
                    transacao_agrupado ta
                    inner join item_transacao_agrupado ita on ita."transacaoAgrupadoId" = ta."id"
                    inner join detalhe_a da on da."itemTransacaoAgrupadoId" = ita.id
                    inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                    inner join arquivo_publicacao ap on ap."itemTransacaoId" = it.id
                        inner join header_lote hl on hl."id" = da."headerLoteId"
inner join header_arquivo ha on ha."id" = hl."headerArquivoId"
                    where (1=1) `;

  private static readonly USER_FROM_24 = `    from
    item_transacao_agrupado ita
    INNER JOIN detalhe_a da ON da."itemTransacaoAgrupadoId" = ita.id
    INNER JOIN item_transacao it ON it."itemTransacaoAgrupadoId" = ita.id
    INNER JOIN arquivo_publicacao ap ON ap."itemTransacaoId" = it.id
    inner join public."user" uu on uu."permitCode" = ita."idOperadora"
    inner join header_lote hl on hl."id" = da."headerLoteId"
    inner join header_arquivo ha on ha."id" = hl."headerArquivoId"
                    where (1=1) `;


  private static readonly ELEICAO_25 = ` FROM
  ordem_pagamento_agrupado opa 
    INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
    inner join ordem_pagamento_unico opu on opu."idOrdemPagamento" = opa.id::VARCHAR
    inner join public."user" pu on pu."cpfCnpj" = opu."operadoraCpfCnpj"
WHERE (1=1) `;

  private static readonly QUERY_CONSOLIDADO_VANZEIROS = `
       WITH latest_opah AS (
          SELECT DISTINCT ON (opah."ordemPagamentoAgrupadoId")
              opah."ordemPagamentoAgrupadoId",
              opah.id AS "opahId",
              opah."dataReferencia",
              opah."statusRemessa",
              opah."motivoStatusRemessa",
              opah."userBankCode",
              opah."userBankAgency",
              opah."userBankAccount",
              opah."userBankAccountDigit"
          FROM ordem_pagamento_agrupado_historico opah
          ORDER BY opah."ordemPagamentoAgrupadoId", opah."dataReferencia" DESC
      )
      SELECT
          op."userId",
          u."fullName",
          COALESCE(da."valorLancamento", SUM(op.valor)) AS "valorTotal"
      FROM ordem_pagamento op
               JOIN ordem_pagamento_agrupado opa
                    ON op."ordemPagamentoAgrupadoId" = opa.id
               JOIN latest_opah l
                    ON l."ordemPagamentoAgrupadoId" = opa.id
               JOIN "user" u
                    ON u.id = op."userId"
               LEFT JOIN detalhe_a da
                         ON da."ordemPagamentoAgrupadoHistoricoId" = l."opahId"
      WHERE 1 = 1
        AND (op."userId" = ANY($1) OR $1 IS NULL)
        AND (
          (
              (date_trunc('day', op."dataCaptura") BETWEEN $2 AND $3 OR $2 IS NULL OR $3 IS NULL)
                  AND l."statusRemessa" NOT IN (2, 3, 4)
              )
              OR
          (
              (date_trunc('day', da."dataVencimento") BETWEEN $2 AND $3 OR $2 IS NULL OR $3 IS NULL)
                  AND l."statusRemessa" IN (2, 3, 4)
              )
          )

          /* statusRemessa array filter */
        AND (
            l."statusRemessa" = ANY($4)
            OR (l."statusRemessa" IS NULL AND 1 = ANY($4))
            OR $4 IS NULL
        )

          /* Exclude certain CPF/CNPJ */
        AND u."cpfCnpj" NOT IN (
                                '18201378000119',
                                '12464869000176',
                                '12464539000180',
                                '12464553000184',
                                '44520687000161',
                                '12464577000133'
          )
      GROUP BY
          op."userId",
          u."fullName",
          da."valorLancamento"
      HAVING
          (SUM(op.valor) >= $5 OR $5 IS NULL)
         AND (SUM(op.valor) <= $6 OR $6 IS NULL)
      ORDER BY
          u."fullName";

  `;

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

  private readonly pendenciasPagas = `
select distinct 
    case when (oph."statusRemessa" = 5) then opa."ordemPagamentoAgrupadoId" else da.id end as id,
    oph."dataReferencia" dataVencimento,
    uu."fullName" as nome,
     case when (oph."statusRemessa" = 5) then 
        round((select "valorTotal" from ordem_pagamento_agrupado where id = opa."ordemPagamentoAgrupadoId" ),2) 
     else 
          da."valorLancamento"
     end as valor,
       CASE
      WHEN op."idOperadora" LIKE '4%' THEN 'STPC'
      WHEN op."idOperadora" LIKE '8%' THEN 'STPL'
      WHEN op."idOperadora" LIKE '7%' THEN 'TEC'
      ELSE op."nomeConsorcio"
    END AS "nomeConsorcio" 
from ordem_pagamento op
inner join ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId"=opa.id
inner join ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa.id
left join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id
left join public."user" uu on uu."id"=op."userId"
where uu.bloqueado = false and
      opa."ordemPagamentoAgrupadoId" in( 
                                    select distinct opaa.id
                                    from ordem_pagamento_agrupado opaa 
                                    inner join ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opaa.id
                                    inner join detalhe_a daa on daa."ordemPagamentoAgrupadoHistoricoId"= oph.id
                                    where daa."dataVencimento" BETWEEN  /* DATA_VENCIMENTO */
                                    and exists(select 1 from ordem_pagamento_agrupado opa2 where opa2."ordemPagamentoAgrupadoId"= opaa.id)
)

and oph."statusRemessa" in(5)
`

  private readonly pendentes_25 = `
SELECT
  DATE(op."dataOrdem") AS dataPagamento,
  op."nomeOperadora" as nome,
  op."valor" AS valor,
  pu."bankCode",
  op."nomeConsorcio"
FROM ordem_pagamento op
INNER JOIN public."user" pu ON pu.id = op."userId"
WHERE
    op."dataOrdem" BETWEEN $1  AND $2 
    AND op."ordemPagamentoAgrupadoId" IS NULL
    AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
    AND op."nomeConsorcio" = ANY($6::text[])
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
`


  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }
  private logger = new CustomLogger(RelatorioNovoRemessaRepository.name, { timestamp: true });

  public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    let sql = ` `;

    let sqlModais;

    let sqlConsorcios;

    if (filter.todosVanzeiros || filter.userIds) {
      sqlModais = this.consultaVanzeiros(filter);
    }

    if (filter.todosConsorcios || filter.consorcioNome) {
      sqlConsorcios = this.consultaConsorcios(filter);

    }

    if (sqlModais && sqlConsorcios) {
      sql = sqlModais + ` union all ` + sqlConsorcios;
    } else if (sqlModais) {
      sql = sqlModais;
    } else if (sqlConsorcios) {
      sql = sqlConsorcios;
    }

    sql = `select * from (${sql}) vv where (1=1) `;

    if (filter.valorMin) {
      sql = sql + ` and vv."valor">=${filter.valorMin} `
    }

    if (filter.valorMax) {
      sql = sql + ` and vv."valor"<=${filter.valorMax} `
    }

    let result: any[] = await queryRunner.query(sql);

    if (filter.pendentes) {
      const pendentes = (await this.pendentesQuery(filter, queryRunner)) ?? [];

      const hasIds =
        !!filter.userIds && (Array.isArray(filter.userIds) ? filter.userIds.length > 0 : true);

      if (filter.todosVanzeiros || hasIds) {
        result = result.concat(pendentes)
      } else {

        for (const r of result) {
          if (!r.nome) continue;

          for (const p of pendentes) {
            if (p.nomeConsorcio === r.nome) {
              const valorResult = Number(r.valor ?? r.total ?? 0);
              const valorPend = Number(p.total ?? p.valor ?? 0);
              r.valor = valorResult + valorPend;
            }
          }
        }

        for (const p of pendentes) {
          const jaExiste = result.some((r: any) => r.nome === p.nomeConsorcio);
          if (!jaExiste) {
            result.push({
              nome: p.nomeConsorcio,
              valor: Number(p.total ?? p.valor ?? 0),
            });
          }
        }

        result = result.map((r: any) => ({
          nome: r.nome,
          valor: Number(r.valor ?? r.total ?? 0),
        }));
      }
    }

    const count = result.length;

    const relatorioConsolidadoDto = new RelatorioConsolidadoNovoRemessaDto();

    let valorTotal = 0;

    if (filter.aPagar != undefined || filter.emProcessamento != undefined) {
      const sqlPagar = this.somatorioTotalAPagar(sql);
      const resultTotal: any[] = await queryRunner.query(sqlPagar);

      const somaPagar = resultTotal.reduce((acc, r) => acc + Number(r.valor), 0);

      valorTotal += somaPagar;
    } else if (filter.pago != undefined || filter.erro != undefined) {
      const sqlPago = this.somatorioTotalPagoErro(sql);
      const resultTotal: any[] = await queryRunner.query(sqlPago);

      const somaPago = resultTotal.reduce((acc, r) => acc + Number(r.valor), 0);

      valorTotal += somaPago;

      if (filter.pendentes) {
        const queryPendentes: any[] = await this.pendentesQuery(filter, queryRunner);
        const somaPendentes = queryPendentes.reduce((acc, r) => acc + Number(r.valor ?? r.total ?? 0), 0);

        valorTotal += somaPendentes;
      }
    } else {
      const sqlPago = this.somatorioTotalPagoErro(sql);
      const resultTotal: any[] = await queryRunner.query(sqlPago);

      const somaPago = resultTotal.reduce((acc, r) => acc + Number(r.valor), 0);

      valorTotal += somaPago;
    }

    relatorioConsolidadoDto.valor = parseFloat(String(valorTotal.toFixed(2)));
    relatorioConsolidadoDto.count = count;

    if (filter.userIds && filter.userIds.length > 0 || filter.todosVanzeiros) {
      const valorPorUsuario: Record<string, number> = {};

      for (const row of result) {
        const nome = row.nome;
        const valor = parseFloat(row.valor);

        if (!valorPorUsuario[nome]) {
          valorPorUsuario[nome] = 0;
        }

        valorPorUsuario[nome] += valor;
      }

      relatorioConsolidadoDto.data = Object.entries(valorPorUsuario).map(([nome, valor]: [string, number]) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = nome;
        elem.valor = parseFloat(valor.toFixed(2)); // agora sem erro
        return elem;
      });
    } else {
      relatorioConsolidadoDto.data = result.map((r) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = r.nome;
        elem.valor = parseFloat(r.valor);
        return elem;
      });
    }

    await queryRunner.release();

    return relatorioConsolidadoDto;
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

  private getStatusParaFiltro(filter: IFindPublicacaoRelatorioNovoRemessa) {
    let statuses: number[] | null = null;
    if (filter.emProcessamento || filter.pago || filter.erro || filter.aPagar || filter.pendenciaPaga) {
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

      if (filter.erro) {
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
    const anoInicio = new Date(filter.dataInicio).getFullYear();
    const anoFim = new Date(filter.dataFim).getFullYear();

    let sql2024 = '';
    let condicoes2024 = '';

    let sqlOutros = '';
    let condicoesOutros = '';

    const hasStatusFilter = filter.aPagar !== undefined || filter.emProcessamento !== undefined || filter.pago !== undefined || filter.erro !== undefined || filter.pendenciaPaga !== undefined;
    // const isPagoOuErro = filter.pago !== undefined || filter.erro !== undefined;
    // --- BLOCO PARA 2024 ---
    if (anoInicio <= 2024) {
      const dataFim24 = anoFim <= 2024 ? dataFim : '2024-12-31'
      sql2024 = `select distinct 
                  ita.id, 
                  da."dataVencimento", 
                 uu."fullName" as nome,
                  da."valorLancamento" as valor,
                  ita."nomeConsorcio" as "nomeConsorcio"
                `;
      sql2024 += RelatorioNovoRemessaRepository.USER_FROM_24;
      condicoes2024 += ` and da."dataVencimento" BETWEEN '${dataInicio}' and '${dataFim24}'
      and da."ocorrenciasCnab" <> 'AM' 
         AND ha."status" <> '5'`;

      if (filter.pago !== undefined || filter.erro !== undefined) {
        condicoes2024 += ` and ap."isPago" = ${filter.pago ? 'true' : 'false'}`;
      }

      if (filter.valorMin !== undefined) {
        condicoes2024 += ` and da."valorLancamento" >= ${filter.valorMin}`;
      }

      if (filter.valorMax !== undefined) {
        condicoes2024 += ` and da."valorLancamento" <= ${filter.valorMax}`;
      }

      if (filter.userIds) {
        condicoes2024 += ` and uu.id in('${filter.userIds.join("','")}')`;
      } else if (filter.todosVanzeiros) {
        condicoes2024 += ` and ita."nomeConsorcio" in('STPC','STPL','TEC')`;
      }

      if (filter.eleicao) {
        condicoes2024 += `AND ita."idOrdemPagamento" LIKE '%U%'`;
      } else if (!filter.pendentes) {
        condicoes2024 += `AND ita."idOrdemPagamento" NOT LIKE '%U%'`;
      }
      if (filter.desativados) {
        condicoes2024 += `AND uu.bloqueado = true`;
      } else {
        condicoes2024 += `AND uu.bloqueado = false`;
      }

    }

    // --- BLOCO PARA 2025 em diante ---
    if (anoFim >= 2025) {
      sqlOutros = `select distinct 
                    da.id,
                    da."dataVencimento", 
                    uu."fullName" as nome, 
                      da."valorRealEfetivado" as valor,
            CASE
      WHEN op."idOperadora" LIKE '4%' THEN 'STPC'
      WHEN op."idOperadora" LIKE '8%' THEN 'STPL'
      WHEN op."idOperadora" LIKE '7%' THEN 'TEC'
      ELSE op."nomeConsorcio"
  END AS "nomeConsorcio"`;
      sqlOutros += RelatorioNovoRemessaRepository.QUERY_FROM
      condicoesOutros += `and da."dataVencimento" BETWEEN '${dataInicio}' and '${dataFim}'`;


      const statuses = this.getStatusParaFiltro(filter);

      if (hasStatusFilter) {
        condicoesOutros += ` and oph."statusRemessa" in (${statuses?.join(',')})\n`;

        const has3or4 = statuses?.includes(3) || statuses?.includes(4);

        if (has3or4) {
          condicoesOutros += ` and oph."motivoStatusRemessa" <> 'AM'\n`;
        }
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
      if (filter.desativados) {
        condicoesOutros += `AND uu.bloqueado = true`;
      } else {
        condicoesOutros += `AND uu.bloqueado = false`;
      }

    }

    // --- return ---
    let finalSQL = '';
    if (sql2024 && sqlOutros) {
      finalSQL = `
      SELECT * FROM (
        (${sql2024} ${condicoes2024})
        UNION ALL
        (${sqlOutros} ${condicoesOutros})
      ) AS resultado
    `;
    } else if (sql2024) {
      finalSQL = sql2024 + condicoes2024;
    } else if (sqlOutros) {
      if (filter.pendenciaPaga) {
        const sqlPendenciaPaga = this.pendenciasPagas.replace(
          '/* DATA_VENCIMENTO */',
          ` '${dataInicio}' and '${dataFim}'`
        );

        finalSQL = `
          ${sqlOutros + condicoesOutros}
          UNION ALL
          ${sqlPendenciaPaga}
          `;
      } else {
        finalSQL = sqlOutros + condicoesOutros;
      }

    }
    this.logger.warn(finalSQL)

    console.log('final SQL')
    console.log(finalSQL)
    return finalSQL;
  }

  private async pendentesQuery(
    filter: IFindPublicacaoRelatorioNovoRemessa,
    queryRunner: QueryRunner
  ) {

    const consorcios =
      filter.consorcioNome && filter.consorcioNome.length > 0
        ? filter.consorcioNome
        : ['SPTC', 'STPL', 'TEC'];

    const anoInicio = new Date(filter.dataInicio).getFullYear();
    const anoFim = new Date(filter.dataFim).getFullYear();

    if (anoInicio === 2024 && anoFim === 2024) {
      const queryParams = [filter.dataInicio, filter.dataFim, filter.userIds, filter.valorMin, filter.valorMax];
      return await queryRunner.query(this.pendentes_24, queryParams);
    }

    if (anoInicio >= 2025 && anoFim >= 2025) {
      const queryParams = [
        filter.dataInicio,
        filter.dataFim,
        filter.userIds,
        filter.valorMin,
        filter.valorMax,
        consorcios
      ]

      let sql = this.pendentes_25

      if (!filter.todosVanzeiros && !filter.userIds) {
        // faz a soma agrupada por consórcio
        sql = `
        SELECT 
          vv."nomeConsorcio",
          SUM(vv.valor) as total
        FROM (${this.pendentes_25}) vv
        GROUP BY vv."nomeConsorcio"
        ORDER BY vv."nomeConsorcio"
      `
      } else {
        //pendenciasPagas apenas adiciona o order by
        sql = `
        SELECT * 
        FROM (${this.pendentes_25}) vv
        ORDER BY vv."nomeConsorcio"
      `
      }

      return await queryRunner.query(sql, queryParams)
    }

    if (anoInicio === 2024 && anoFim >= 2025) {
      const ateFinal2024 = `${anoInicio}-12-31`;
      const inicio2025 = `2025-01-01`;

      const queryParams2024 = [filter.dataInicio, ateFinal2024, filter.userIds, filter.valorMin, filter.valorMax, filter.consorcioNome];
      const queryParams2025 = [inicio2025, filter.dataFim, filter.userIds, filter.valorMin, filter.valorMax, consorcios];

      const result2024 = await queryRunner.query(this.pendentes_24, queryParams2024);
      const result2025 = await queryRunner.query(this.pendentes_25, queryParams2025);

      return result2024.concat(result2025);
    }
  }



  private consultaConsorcios(filter: IFindPublicacaoRelatorioNovoRemessa) {
    const dataInicio = formatDateISODate(filter.dataInicio);
    const dataFim = formatDateISODate(filter.dataFim);
    const anoInicio = new Date(filter.dataInicio).getFullYear();
    const anoFim = new Date(filter.dataFim).getFullYear();
    const dataFim24 = anoFim <= 2024 ? dataFim : '2024-12-31'
    const incluir2024 = anoInicio <= 2024 && anoFim >= 2024;
    const incluirOutros = !(anoInicio === 2024 && anoFim === 2024);

    const hasStatusFilter = filter.aPagar !== undefined || filter.emProcessamento !== undefined || filter.pago !== undefined || filter.erro !== undefined;
    const statuses = this.getStatusParaFiltro(filter);

    let sql2024 = '';
    let sqlOutros = '';
    let condicoes2024 = ` and da."dataVencimento" BETWEEN '${dataInicio}' and '${dataFim24}'
    and da."ocorrenciasCnab" <> 'AM' 
  AND ha."status" <> '5'`;
    let condicoesOutros = `  where (1=1) and r."dataVencimento" BETWEEN '${dataInicio}' and '${dataFim}'`;
    // --- BLOCO PARA 2024 ---
    if (incluir2024) {
      sql2024 = `
        SELECT distinct
    ita.id,
      da."dataVencimento",
        ita."nomeOperadora" as "fullName",
          ita."nomeConsorcio" as nome,
            da."valorLancamento" as valor
        ${RelatorioNovoRemessaRepository.QUERY_FROM_24}
    `;
      condicoes2024 += ` AND ap."isPago" = ${filter.pago ? 'true' : 'false'} `;
    }
    // --- BLOCO PARA 2025 em diante ---
    if (incluirOutros) {
      if (filter.eleicao) {
        sqlOutros = `
     SELECT DISTINCT
    da.id,
      da."dataVencimento" AS dataPagamento,
        pu."fullName" as nome,
          opu.consorcio,
          ${filter.aPagar !== undefined ? 'opa."valorTotal"' : 'da."valorLancamento"'} as valor
        ${RelatorioNovoRemessaRepository.ELEICAO_25}
    `;
      } else {
        sqlOutros = `
        SELECT distinct
    da.id,
      da."dataVencimento",
        uu."fullName",
          uu."permitCode",
            oph."statusRemessa",
              oph."motivoStatusRemessa",
                op."nomeConsorcio",
                  CASE
                                WHEN op."idOperadora" = '8' THEN 'VLT'
                                WHEN op."idOperadora" LIKE '4%' THEN 'STPC'
                                WHEN op."idOperadora" LIKE '8%' THEN 'STPL'
                                WHEN op."idOperadora" LIKE '7%' THEN 'TEC'
                                ELSE op."nomeConsorcio"
                            END AS "nome",
      da."valorLancamento" as valor
        ${RelatorioNovoRemessaRepository.QUERY_FROM}
    `;
      }


      //if (filter.desativados) {
      //  condicoesOutros += `AND r.bloqueado = true`;
      // } else {
      //  condicoesOutros += `AND r.bloqueado = false`;
      // }
      if (hasStatusFilter) {
        condicoesOutros += `  and r."statusRemessa" in (${statuses?.join(',')})\n`;

        const has3or4 = statuses?.includes(3) || statuses?.includes(4);

        if (has3or4) {
          condicoesOutros += ` and r."motivoStatusRemessa" <> 'AM'\n`;
        }
      }
    }

    if (filter.todosConsorcios) {
      const consorcios = `'STPC','STPL','VLT','Santa Cruz','Internorte','Intersul','Transcarioca','MobiRio','TEC'`;
      condicoes2024 += ` AND ita."nomeConsorcio" IN (${consorcios}) `;
      condicoesOutros += ` AND ${filter.eleicao ? 'r.consorcio' : 'r."nome"'} IN (${consorcios}) `;
    } else if (filter.consorcioNome) {
      const nomes = `'${filter.consorcioNome.join("','")}'`;
      condicoes2024 += ` AND ita."nomeConsorcio" IN (${nomes}) `;
      condicoesOutros += ` AND ${filter.eleicao ? 'r.consorcio' : 'r."nome"'} IN (${nomes}) `;
    }
    if (filter.eleicao) {
      condicoes2024 += `  AND ita."idOrdemPagamento" LIKE '%U%'`;
      // condicoesOutros += `      AND ita."idOrdemPagamento" LIKE '%U%'`;
    } else {
      condicoes2024 += `  AND ita."idOrdemPagamento" NOT LIKE '%U%'`;
    }
    if (filter.desativados) {
      condicoes2024 += `AND pu.bloqueado = true`;
    } else {
      condicoes2024 += `AND pu.bloqueado = false`;
    }

    // --- return ---
    let finalSQL = '';
    if ((filter.pago !== undefined || filter.erro !== undefined) && sql2024 && sqlOutros) {
      finalSQL = `
        SELECT nome, NULL as "nomeConsorcio", SUM(valor) as valor
        FROM (
          (${sql2024} ${condicoes2024})
          UNION ALL
          (${sqlOutros} ${condicoesOutros})
        ) AS r
        GROUP BY r.nome
      `;
    } else if (sql2024) {
      finalSQL = `
        SELECT nome, NULL as "nomeConsorcio", SUM(valor) as valor
        FROM (${sql2024} ${condicoes2024}) AS r
        GROUP BY r.nome
      `;
    } else if (sqlOutros) {
      if (filter.pendenciaPaga) {
        const sqlPendenciaPaga = this.pendenciasPagas.replace(
          '/* DATA_VENCIMENTO */',
          ` '${dataInicio}' and '${dataFim}'`
        );

        finalSQL = `
        SELECT nome, SUM(valor) AS valor
          FROM (
            SELECT r.nome, SUM(valor) AS valor
            FROM (${sqlOutros}) AS r
            ${condicoesOutros}
            GROUP BY r.nome

          UNION ALL

          SELECT r."nomeConsorcio" AS nome, SUM(valor) AS valor
            FROM (${sqlPendenciaPaga}) AS r
            GROUP BY r."nomeConsorcio"
          ) AS uniao
        GROUP BY nome
        ORDER BY nome 
      `;
      } else {
        finalSQL = `
        SELECT nome, NULL as "nomeConsorcio", SUM(valor) as valor
        FROM (${sqlOutros}) AS r  ${condicoesOutros}
        GROUP BY r.nome
      `;
      }

    }
    this.logger.warn(finalSQL)
    return finalSQL;
  }


  private somatorioTotalPagoErro(sql: string) {
    return `select sum("valor") valor from(` + sql + `) s `;
  }

  private somatorioTotalAPagar(sql: string) {
    return `select sum("valor") valor from(` + sql + `) s`;
  }
}
