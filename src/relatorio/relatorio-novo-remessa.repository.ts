import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { IFindPublicacaoRelatorioNovoRemessa } from './interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from './dtos/relatorio-consolidado-novo-remessa.dto';
import { parseNumber } from '../cnab/utils/cnab/cnab-field-utils';
import { fi } from 'date-fns/locale';
import { RelatorioSinteticoDto } from './dtos/relatorio-sintetico.dto';
import {
  RelatorioSinteticoNovoRemessaConsorcio,
  RelatorioSinteticoNovoRemessaDia,
  RelatorioSinteticoNovoRemessaDto, RelatorioSinteticoNovoRemessaFavorecido,
} from './dtos/relatorio-sintetico-novo-remessa.dto';

@Injectable()
export class RelatorioNovoRemessaRepository {
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

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}
  private logger = new CustomLogger(RelatorioNovoRemessaRepository.name, { timestamp: true });

  public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {
    if (filter.consorcioNome) {
      filter.consorcioNome = filter.consorcioNome.map((c) => {
        return c.toUpperCase().trim();
      });
    }

    const parametersQueryVanzeiros = [filter.userIds || null, filter.dataInicio || null, filter.dataFim || null, this.getStatusParaFiltro(filter), filter.valorMin || null, filter.valorMax || null];

    const parametersQueryConsorciosEModais = [filter.dataInicio || null, filter.dataFim || null, this.getStatusParaFiltro(filter), filter.consorcioNome || null, filter.valorMin || null, filter.valorMax || null];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = [];
    let resultConsorciosEModais: any[] = [];
    let resultVanzeiros: any[] = [];

    if (filter.todosVanzeiros) {
      filter.userIds = undefined;
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_VANZEIROS, parametersQueryVanzeiros);
    }

    if (filter.todosConsorcios) {
      filter.consorcioNome = undefined;
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    if (filter.userIds && filter.userIds.length > 0) {
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_VANZEIROS, parametersQueryVanzeiros);
    }

    if (filter.consorcioNome && filter.consorcioNome.length > 0) {
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    // Nenhum critério, trás todos.
    if (!filter.todosVanzeiros && !filter.todosConsorcios && (!filter.userIds || filter.userIds.length == 0) && (!filter.consorcioNome || filter.consorcioNome.length == 0)) {
      resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_VANZEIROS, parametersQueryVanzeiros);
      resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_CONSORCIOS, parametersQueryConsorciosEModais);
    }

    result = resultVanzeiros.concat(resultConsorciosEModais);

    await queryRunner.release();
    const count = result.length;
    const valorTotal = result.reduce((acc, curr) => acc + parseFloat(curr.valorTotal), 0);
    const relatorioConsolidadoDto = new RelatorioConsolidadoNovoRemessaDto();
    relatorioConsolidadoDto.valor = parseFloat(valorTotal);
    relatorioConsolidadoDto.count = count;
    relatorioConsolidadoDto.data = result.map((r) => {
      const elem = new RelatorioConsolidadoNovoRemessaData();
      elem.nomefavorecido = r.fullName;
      elem.valor = parseFloat(r.valorTotal);
      return elem;
    });

    return relatorioConsolidadoDto;
  }

  public async findSintetico(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioSinteticoNovoRemessaDto> {
    if (filter.consorcioNome) {
      filter.consorcioNome = filter.consorcioNome.map((c) => {
        return c.toUpperCase().trim();
      });
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
    if (filter.emProcessamento || filter.pago || filter.erro || filter.aPagar) {
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
    }
    return statuses;
  }
}