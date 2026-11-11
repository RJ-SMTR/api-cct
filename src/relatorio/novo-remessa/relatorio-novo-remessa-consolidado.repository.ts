import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { format, parse } from 'date-fns';
import { CustomLogger } from 'src/utils/custom-logger';
import { agrupamentoSemFilhas, buildStucGratuidadeQuery, eleicaoConsorcioFiltroCase, buildStucGratuidadePendenciaPagaSingleDateQuery, buildStucGratuidadePendenciaPagamentoSingleDateQuery } from './queries/novo-remessa-query-builder';
import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { filtrarPeloTotalDoFavorecido, pivotStucGratuidadeRows } from '../utils/stuc-gratuidade-pivot';
import { pendenciaOrdemSoltaPermissionario, pendenciaRejeitadaPermissionario } from './queries/regras-pendencia';


@Injectable()
export class RelatorioNovoRemessaConsolidadoRepository {
  private readonly logger = new CustomLogger(RelatorioNovoRemessaConsolidadoRepository.name, { timestamp: true });

  private readonly MODAIS = ['STPC', 'STPL', 'TEC'];

  private readonly CONSORCIOS = ['VLT', 'Intersul', 'Transcarioca', 'Internorte', 'MobiRio', 'Santa Cruz', 'MOBI-Rio BUM', 'TUSE', 'STPC', 'STPL', 'TEC', 'GTU'];

  // Mesmo CASE usado nos headerQuery* abaixo para rotular "nome": o permitCode do usuário tem
  // prioridade sobre o nomeConsorcio/consorcio bruto do pagamento. O filtro de consorcioNome
  // precisa comparar contra este mesmo CASE (não a coluna bruta), senão um pagamento cujo
  // nomeConsorcio bruto diverge do permitCode do usuário aparece rotulado num consórcio mas é
  // selecionado pelo filtro de outro.
  private readonly consorcioCaseSimples = `CASE
    WHEN pu."permitCode" = '8' THEN 'VLT'
    WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
    WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
    WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
    ELSE op."nomeConsorcio"
  END`;

  private readonly consorcioCaseDuplo = `CASE
    WHEN pu."permitCode" = '8' OR puu."permitCode" = '8' THEN 'VLT'
    WHEN pu."permitCode" LIKE '4%' OR puu."permitCode" LIKE '4%' THEN 'STPC'
    WHEN pu."permitCode" LIKE '81%' OR puu."permitCode" LIKE '81%' THEN 'STPL'
    WHEN pu."permitCode" LIKE '7%' OR puu."permitCode" LIKE '7%' THEN 'TEC'
    ELSE COALESCE(op."nomeConsorcio", opp."nomeConsorcio")
  END`;

  private readonly headerQueryConsorciosApagar = ` select distinct CASE
                                                    WHEN pu."permitCode" = '8'  THEN 'VLT'
                                                      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                                      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                                      WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                                      ELSE op."nomeConsorcio"
                                                    END AS "nome" ,  
                                                    pu."fullName" AS "nome2",                 
                                                    op."valor" AS valor, op."id" AS "idLinha"	`;

  private readonly headerQueryConsorcios = ` select distinct CASE
                                                WHEN pu."permitCode" = '8' OR puu."permitCode" = '8' THEN 'VLT'
                                                WHEN pu."permitCode" LIKE '4%' OR puu."permitCode" LIKE '4%' THEN 'STPC'
                                                WHEN pu."permitCode" LIKE '81%' OR puu."permitCode" LIKE '81%' THEN 'STPL'
                                                WHEN pu."permitCode" LIKE '7%' OR puu."permitCode" LIKE '7%' THEN 'TEC'
                                                ELSE COALESCE(op."nomeConsorcio", opp."nomeConsorcio")
                                              END AS "nome" ,            
                                              coalesce(pu."fullName", puu."fullName") AS "nome2",        
                                              da."valorLancamento" AS valor, da."id" AS "idLinha"	`;

  private readonly headerQueryVanzeirosAPagar = ` select distinct pu."fullName" AS "nome",
                                                  op."nomeConsorcio" AS "nome2",                                                  
                                                  op."valor" AS valor, op."id" AS "idLinha"	`;

  private readonly headerQueryVanzeiros = ` select distinct coalesce(pu."fullName", puu."fullName") AS "nome",
                                            CASE
                                              WHEN pu."permitCode" = '8' OR puu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' OR puu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' OR puu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' OR puu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE COALESCE(op."nomeConsorcio", opp."nomeConsorcio")
                                            END AS "nome2",                                           
                                            da."valorLancamento" AS valor, da."id" AS "idLinha"	`;

  private readonly headerQueryEleicaoVanzereiroApagar = ` select distinct pu."fullName" AS "nome",
                                            CASE
                                              WHEN pu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE op."consorcio" 
                                            END AS "nome2", 
                                            op."valorTotalTransacaoLiquido" AS valor, op."id" AS "idLinha"`;


  private readonly headerQueryEleicaoConsorcioApagar = ` select distinct 
                                              CASE
                                              WHEN pu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE op."consorcio" 
                                            END AS "nome",pu."fullName" AS "nome2",                                             
                                            op."valorTotalTransacaoLiquido" AS valor, op."id" AS "idLinha"`;

  private readonly headerQueryEleicaoVanzeiro = ` select distinct pu."fullName" AS "nome",
                                            CASE
                                              WHEN pu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE op."consorcio" 
                                            END AS "nome2",                                           
                                            da."valorLancamento" AS valor, da."id" AS "idLinha"	`;

  private readonly headerQueryEleicaoConsorcio = ` select distinct 
                                            CASE
                                              WHEN pu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE op."consorcio" 
                                            END AS "nome",
                                            pu."fullName" AS "nome2",                                                                                       
                                            da."valorLancamento" AS valor, da."id" AS "idLinha"	`;

  private readonly fromQueryApagar = ` from ordem_pagamento op
                                        left join ordem_pagamento_agrupado opa  on op."ordemPagamentoAgrupadoId"=opa.id
                                        left join public.user pu on pu."id"=op."userId"	              
                                        left join ordem_pagamento_agrupado_historico oph on opa."id"= oph."ordemPagamentoAgrupadoId"
                                        left join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = oph.id`;

  // ADR 0016: trazer TODAS as ordem_pagamento internas do agrupamento multiplicava cada linha de detalhe_a pelo número
  // de ordens (agrupamento real com 55 ordens para 1 lançamento esgotou a memória do Postgres em 90 dias com "Todos").
  // Só interessa uma ordem representante (a de menor id) para achar favorecido e consórcio:
  //  - op: representante do próprio agrupamento, por LATERAL (índice em ordem_pagamento."ordemPagamentoAgrupadoId",
  //    para na primeira ordem);
  //  - opp: representante das filhas do agrupamento (quando ele é pai), vindo do CTE pai_representante
  //    (cteFilhasRepresentantes), calculado uma vez por consulta em vez de um join por linha com a tabela inteira de
  //    ordem_pagamento (1 milhão de linhas, duas vezes) - com isso o histórico passou de mais de 150 s para cerca de 2 s
  //    no banco de teste, com o mesmo resultado. O CTE é MATERIALIZED de propósito: como subselect no JOIN o planner,
  //    achando que sobrava 1 linha, o reavaliava por linha (Pendência Paga sozinha foi de 0,6 s para 28 s).
  // O LEFT JOIN continua trazendo a linha com op/opp nulos quando não há ordem.
  private readonly cteFilhasRepresentantes = `WITH pai_representante AS MATERIALIZED (
    select distinct on (f."ordemPagamentoAgrupadoId")
           f."ordemPagamentoAgrupadoId" as pai_id, o."userId", o."nomeConsorcio", o."operadoraCpfCnpj"
      from ordem_pagamento_agrupado f
      join ordem_pagamento o on o."ordemPagamentoAgrupadoId" = f.id
     where f."ordemPagamentoAgrupadoId" is not null
     order by f."ordemPagamentoAgrupadoId", o.id
  ) `;

  private readonly fromQueryPrincipal = ` from detalhe_a da
                                          left join ordem_pagamento_agrupado_historico oph on oph."id"=da."ordemPagamentoAgrupadoHistoricoId"
                                          left join ordem_pagamento_agrupado opafi on opafi."id"=oph."ordemPagamentoAgrupadoId"
                                          left join lateral (
                                            select o."userId", o."nomeConsorcio", o."operadoraCpfCnpj"
                                              from ordem_pagamento o
                                             where o."ordemPagamentoAgrupadoId" = opafi.id
                                             order by o.id
                                             limit 1
                                          ) op on true
                                          left join public.user pu on pu."id"=op."userId"
                                          left join pai_representante opp on opp.pai_id = opafi.id
                                          left join public.user puu on puu."id"=opp."userId" `;

  // Mesmo fromQueryPrincipal, com o join a mais pro agrupamento "pai" (op_pai) que a Pendência
  // Paga precisa: quando o agrupamento da linha tem pai, a data de pagamento real é a do pai, não
  // a dele mesmo (mesma regra de opa."ordemPagamentoAgrupadoId" / op_pai do query-builder
  // compartilhado - ver getQueryPendenciaPagaConsorcios/Vanzeiros).
  private readonly fromQueryPrincipalComPai = this.fromQueryPrincipal +
    ` left join ordem_pagamento_agrupado op_pai on op_pai."id"=opafi."ordemPagamentoAgrupadoId" `;

  // Usuario por permitCode, com fallback por CPF so quando ninguem tem esse permitCode - mesma regra
  // de buildEleicaoQuery (Movimentacao Financeira). So por CPF, um CPF com dois cadastros dobrava o valor.
  private readonly fromQueryEleicaoAPagar = ` from ordem_pagamento_unico op 
                                             left join lateral (
                                               select u.* from public.user u where u."permitCode" = op."idOperadora"
                                               union all
                                               select u.* from public.user u
                                               where not exists (select 1 from public.user u2 where u2."permitCode" = op."idOperadora")
                                                 and u."cpfCnpj" = op."operadoraCpfCnpj"
                                             ) pu on true `

  // Inner joins up to ordem_pagamento_unico: only Eleicao payments enter the user lateral. With left
  // joins every detalhe_a of the period ran it (three unindexed lookups on "user" per row) and
  // Eleicao filtered by consorcio or favorecido took over 180 s in staging. Rows without an Eleicao
  // order were already dropped by every consorcio/favorecido filter, so the totals do not change.
  private readonly fromQueryEleicao = ` from detalhe_a da
                                        inner join ordem_pagamento_agrupado_historico oph on oph."id"=da."ordemPagamentoAgrupadoHistoricoId"
                                        inner join ordem_pagamento_agrupado opa on opa."id"=oph."ordemPagamentoAgrupadoId"
                                        inner join ordem_pagamento_unico op on op."idOrdemPagamento"=opa."id"::varchar
                                        left join lateral (
                                               select u.* from public.user u where u."permitCode" = op."idOperadora"
                                               union all
                                               select u.* from public.user u
                                               where not exists (select 1 from public.user u2 where u2."permitCode" = op."idOperadora")
                                                 and u."cpfCnpj" = op."operadoraCpfCnpj"
                                             ) pu on true `;


  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  private getQueryApagarConsorcios(dataInicio: string, dataFim: string, aPagar?: boolean, pendente?: boolean): string {
    return ` ${this.headerQueryConsorciosApagar}                    
             ${this.fromQueryApagar}
             ${this.getWhereApagar(dataInicio, dataFim, aPagar, pendente)} `;
  }

  private getQueryApagarVanzeiros(dataInicio: string, dataFim: string, aPagar?: boolean, pendente?: boolean): string {
    return ` ${this.headerQueryVanzeirosAPagar}                    
             ${this.fromQueryApagar}  
             ${this.getWhereApagar(dataInicio, dataFim, aPagar, pendente)} `;
  }

  private getWhereApagar(dataInicio: string, dataFim: string, aPagar?: boolean, pendente?: boolean): string {
    const dataMinima = this.getDataMinima();
    const dataInicioDate = new Date(dataInicio);
    let where = ``;
    if (aPagar) {
      if (dataMinima && (dataMinima.getTime() >= dataInicioDate.getTime())) {
        dataInicio = dataMinima.toISOString();
      }
      where += ` where ((op."ordemPagamentoAgrupadoId" is null) OR (da.id is null))
               and (pu."bloqueado" is null OR pu."bloqueado" = false)
               and op."dataCaptura" >= '${dataInicio}'::date AND op."dataCaptura" < '${dataFim}'::date + interval '1 day'`;

    } else if (pendente) {
      // Atrasadas = ordens anteriores ao ciclo atual; a data final nunca passa do corte nem da data pedida.
      if (dataMinima) {
        const corte = new Date(dataMinima);
        corte.setDate(corte.getDate() - 2);
        if (corte.getTime() < new Date(dataFim).getTime()) {
          dataFim = corte.toISOString();
        }
      }
      // Mesmas regras do PASSO 0 da procedure de pendentes (queries/regras-pendencia.ts).
      where += ` where (op."ordemPagamentoAgrupadoId" is null) and (pu."bloqueado" is null OR pu."bloqueado" = false)
               and op."dataCaptura" >= '${dataInicio}'::date AND op."dataCaptura" < '${dataFim}'::date + interval '1 day'
               ${pendenciaOrdemSoltaPermissionario('op', 'pu')}`;

    }
    return where;
  }

  private getQueryApagarEleicaoConsorcio(dataInicio: string, dataFim: string): string {
    return ` ${this.headerQueryEleicaoConsorcioApagar}
             ${this.fromQueryEleicaoAPagar}
             where op."dataOrdem" BETWEEN '${dataInicio}' AND '${dataFim}' AND op."idOrdemPagamento" is null
               and (pu."bloqueado" is null OR pu."bloqueado" = false)`;
  }

  private getQueryApagarEleicaoVanzeiro(dataInicio: string, dataFim: string): string {
    return ` ${this.headerQueryEleicaoVanzereiroApagar}
             ${this.fromQueryEleicaoAPagar}
             where op."dataOrdem" BETWEEN '${dataInicio}' AND '${dataFim}' AND op."idOrdemPagamento" is null
               and (pu."bloqueado" is null OR pu."bloqueado" = false)`;
  }

  // NOT EXISTS/motivoStatusRemessa: mesmos guards de getQueryPendenciaPagaConsorcios/Vanzeiros
  // (ADR 0011) - sem eles, agrupamentos substituídos/reenviados entravam na consulta; o SELECT
  // DISTINCT (nome, nome2, valor, idLinha) e o filtro externo "nome IS NOT NULL" descartavam
  // essas linhas por acidente (o join opafi/opai/opp resulta em nome/nome2 nulos nesses casos),
  // não por design.
  // ADR 0014 (Movimentação Financeira): sem favorecido/consórcio específico selecionado ("Todos"),
  // exclui da busca os 6 CNPJs que representam o próprio consórcio (não um vanzeiro individual) -
  // eles entram em queryConsorcios/queryPendenciaPagaConsorcios via op."nomeConsorcio" (ramo ELSE
  // de consorcioCaseDuplo) porque pagam direto, sem o permitCode especial de VLT/STPC/STPL/TEC.
  // Sem esta exclusão o Consolidado soma esses pagamentos institucionais junto com o agregado do
  // consórcio, mas a Movimentação Financeira (NOT_CPF_FILTER, novo-remessa-query-builder.ts) os
  // exclui - divergência confirmada contra hml: R$ 143.356.841,60 de diferença exata entre os
  // dois relatórios pros mesmos filtros (Permissionário/Pago/01-10 a 03-11-2026) é a soma desses
  // 6 CNPJs no período. Só se aplica à busca "Todos": selecionar um consórcio específico continua
  // trazendo o CNPJ institucional dele (mesma regra do ADR 0014 pro eixo vanzeiro).
  private readonly excluiCnpjConsorcioInstitucional = `
               AND (COALESCE(pu."cpfCnpj", puu."cpfCnpj") IS NULL OR COALESCE(pu."cpfCnpj", puu."cpfCnpj") NOT IN (
                 '18201378000119', '12464869000176', '12464539000180', '12464553000184', '44520687000161', '12464577000133'
               ))`;

  // Pagamento de pendentes: o "pai" agrupa as filhas rejeitadas e é o que vai ao banco. Enquanto está em andamento
  // (criado, enviado ou aguardando retorno: status 0/1/2) ele aparece no relatório - é o valor do remessa - e as filhas
  // rejeitadas que ele cobre saem da lista, para o mesmo valor não contar duas vezes. Depois do retorno (pago/rejeitado)
  // vale a regra de sempre: o pai fica oculto e as filhas aparecem como Pendência Paga (ou Rejeitado).
  private readonly excluiAgrupamentoSubstituido = `
               and (${agrupamentoSemFilhas('opafi')}
                    OR oph."statusRemessa" IN (0, 1, 2))
               and NOT (oph."statusRemessa" = 4 AND EXISTS (
                    SELECT 1 FROM ordem_pagamento_agrupado_historico hp_pai
                     WHERE hp_pai."ordemPagamentoAgrupadoId" = opafi."ordemPagamentoAgrupadoId"
                       AND hp_pai."statusRemessa" IN (0, 1, 2)))
               and (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)`;

  private getQueryConsorcios(dataInicio: string, dataFim: string): string {
    return `   ${this.headerQueryConsorcios}
               ${this.fromQueryPrincipal}
               where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day'
               and (pu."bloqueado" is null OR pu."bloqueado" = false)
               and (puu."bloqueado" is null OR puu."bloqueado" = false)
               ${this.excluiAgrupamentoSubstituido} `;
  }

  private getQueryVanzeiros(dataInicio: string, dataFim: string): string {
    return `  ${this.headerQueryVanzeiros}
              ${this.fromQueryPrincipal}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day'
              and (pu."bloqueado" is null OR pu."bloqueado" = false)
              and (puu."bloqueado" is null OR puu."bloqueado" = false)
              ${this.excluiAgrupamentoSubstituido} `;
  }

  // Pendência Paga é consultada pela data de pagamento (real), não pelo vencimento - mesma regra
  // já aplicada no query-builder compartilhado (buildPendenciaPagaSingleDateQuery, usado pelo
  // Guardador e pela Movimentação Financeira). Sem isso, o Consolidado do Permissionário trazia
  // os pagamentos cujo VENCIMENTO caía no período, divergindo do total da Movimentação Financeira
  // (que usa a data de pagamento) mesmo com os mesmos filtros.
  // Guard clauses abaixo (motivoStatusRemessa NOT IN ('AM','AE') e "NOT EXISTS filha") espelham
  // exatamente as do query-builder compartilhado. Sem elas, um agrupamento que passou por mais de
  // um histórico com statusRemessa=5 (ex.: reenvio) conta o mesmo pagamento 2x - foi assim que o
  // total do Consolidado saiu em dobro na primeira tentativa desta correção.
  // umaLinhaPorFilhaPaga: a filha pode ter mais de uma linha em detalhe_a (ex.: reenvio dentro do
  // mesmo agrupamento, sem trocar de pai) - sem restringir a uma só, cada detalhe_a extra soma o
  // mesmo pagamento de novo. Mesma lógica de umaLinhaPorFilhaPagaFilter (query-builder
  // compartilhado): prioriza a linha cujo valor bate com o valorTotal do agrupamento; sem
  // nenhuma batendo, a mais recente (achado 2026-11-06, testando contra produção - excesso de
  // R$ 16,53/11.210,06/4.497,60 em mar/mai/jun bate exatamente com a filha em dobro).
  private readonly umaLinhaPorFilhaPaga = `
                 and da.id = (
                   SELECT da_filha.id
                   FROM ordem_pagamento_agrupado_historico oph_filha
                   INNER JOIN detalhe_a da_filha
                     ON da_filha."ordemPagamentoAgrupadoHistoricoId" = oph_filha.id
                   WHERE oph_filha."ordemPagamentoAgrupadoId" = opafi.id
                     AND oph_filha."statusRemessa" = 5
                   ORDER BY
                     (ROUND(da_filha."valorLancamento"::numeric, 2) = ROUND(opafi."valorTotal"::numeric, 2)) DESC,
                     da_filha.id DESC
                   LIMIT 1
                 ) `;

  private getQueryPendenciaPagaConsorcios(dataInicio: string, dataFim: string): string {
    return `   ${this.headerQueryConsorcios}
               ${this.fromQueryPrincipalComPai}
               where oph."statusRemessa" = 5
                 and (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
                 and ${agrupamentoSemFilhas('opafi')}
                 and (pu."bloqueado" is null OR pu."bloqueado" = false)
                 and (puu."bloqueado" is null OR puu."bloqueado" = false)
                 and (
                   (opafi."ordemPagamentoAgrupadoId" is not null and op_pai."dataPagamento"::date BETWEEN '${dataInicio}'::date AND '${dataFim}'::date)
                   or
                   (opafi."ordemPagamentoAgrupadoId" is null and opafi."dataPagamento"::date BETWEEN '${dataInicio}'::date AND '${dataFim}'::date)
                 )
                 ${this.umaLinhaPorFilhaPaga} `;
  }

  private getQueryPendenciaPagaVanzeiros(dataInicio: string, dataFim: string): string {
    return `  ${this.headerQueryVanzeiros}
              ${this.fromQueryPrincipalComPai}
              where oph."statusRemessa" = 5
                and (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
                and ${agrupamentoSemFilhas('opafi')}
                and (pu."bloqueado" is null OR pu."bloqueado" = false)
                and (puu."bloqueado" is null OR puu."bloqueado" = false)
                and (
                  (opafi."ordemPagamentoAgrupadoId" is not null and op_pai."dataPagamento"::date BETWEEN '${dataInicio}'::date AND '${dataFim}'::date)
                  or
                  (opafi."ordemPagamentoAgrupadoId" is null and opafi."dataPagamento"::date BETWEEN '${dataInicio}'::date AND '${dataFim}'::date)
                )
                ${this.umaLinhaPorFilhaPaga} `;
  }

  // PASSO 0: filhas pagas (status 5) que nunca foram enviadas em arquivo próprio - nenhum
  // histórico delas tem detalhe_a, então getQueryPendenciaPagaConsorcios/Vanzeiros (que partem de
  // "from detalhe_a da") nunca as encontra. Mesma lógica de buildPendenciaPagaPasso0Query
  // (query-builder compartilhado, já usado pela Movimentação Financeira/Guardador) - valor é o
  // valorTotal da OPA da filha, data é a dataPagamento do pai (achado 2026-11-06, testando contra
  // produção: R$ 14.614,50 de diferença em 08/10/2026 batia exatamente com essas filhas).
  private getQueryPendenciaPagaPasso0Consorcios(dataInicio: string, dataFim: string): string {
    return ` select distinct CASE
               WHEN pu."permitCode" = '8' THEN 'VLT'
               WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
               WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
               WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
               ELSE op."nomeConsorcio"
             END AS "nome",
             pu."fullName" AS "nome2",
             opafi."valorTotal" AS valor, opafi."id" AS "idLinha"
             ${this.fromQueryPendenciaPagaPasso0}
             ${this.whereQueryPendenciaPagaPasso0(dataInicio, dataFim)} `;
  }

  private getQueryPendenciaPagaPasso0Vanzeiros(dataInicio: string, dataFim: string): string {
    return ` select distinct pu."fullName" AS "nome",
             CASE
               WHEN pu."permitCode" = '8' THEN 'VLT'
               WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
               WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
               WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
               ELSE op."nomeConsorcio"
             END AS "nome2",
             opafi."valorTotal" AS valor, opafi."id" AS "idLinha"
             ${this.fromQueryPendenciaPagaPasso0}
             ${this.whereQueryPendenciaPagaPasso0(dataInicio, dataFim)} `;
  }

  private readonly fromQueryPendenciaPagaPasso0 = ` from ordem_pagamento_agrupado opafi
             inner join ordem_pagamento_agrupado op_pai on op_pai."id" = opafi."ordemPagamentoAgrupadoId"
             left join lateral (
               select o."userId", o."nomeConsorcio", o."operadoraCpfCnpj"
                 from ordem_pagamento o
                where o."ordemPagamentoAgrupadoId" = opafi.id
                order by o.id
                limit 1
             ) op on true
             left join public."user" pu on pu."id" = op."userId" `;

  private whereQueryPendenciaPagaPasso0(dataInicio: string, dataFim: string): string {
    return ` where ${agrupamentoSemFilhas('opafi')}
               and (pu."bloqueado" is null OR pu."bloqueado" = false)
               and op_pai."dataPagamento"::date BETWEEN '${dataInicio}'::date AND '${dataFim}'::date
               and EXISTS (
                 SELECT 1 FROM ordem_pagamento_agrupado_historico oph_recente
                  WHERE oph_recente."ordemPagamentoAgrupadoId" = opafi.id
                    AND oph_recente.id = (
                      SELECT MAX(oph_mais_recente.id) FROM ordem_pagamento_agrupado_historico oph_mais_recente
                       WHERE oph_mais_recente."ordemPagamentoAgrupadoId" = opafi.id
                    )
                    AND oph_recente."statusRemessa" = 5
                    AND (oph_recente."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph_recente."motivoStatusRemessa" IS NULL)
               )
               and NOT EXISTS (
                 SELECT 1 FROM ordem_pagamento_agrupado_historico oph_qualquer
                 INNER JOIN detalhe_a da_qualquer
                   ON da_qualquer."ordemPagamentoAgrupadoHistoricoId" = oph_qualquer.id
                 WHERE oph_qualquer."ordemPagamentoAgrupadoId" = opafi.id
               ) `;
  }

  private getQueryEleicaoConsorcio(dataInicio: string, dataFim: string): string {
    return `  ${this.headerQueryEleicaoConsorcio}
              ${this.fromQueryEleicao}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day'
                and (pu."bloqueado" is null OR pu."bloqueado" = false) `;
  }

  private getQueryEleicaoVanzeiro(dataInicio: string, dataFim: string): string {
    return `  ${this.headerQueryEleicaoVanzeiro}
              ${this.fromQueryEleicao}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day'
                and (pu."bloqueado" is null OR pu."bloqueado" = false) `;
  }

  public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {

    // Sem consorcioNome/userIds nem todosConsorcios/todosVanzeiros, nenhuma das consultas abaixo é
    // incluída (ver "temFiltroConsorcio"/"temFiltroVanzeiros" mais adiante) e o método sempre
    // devolve {data: [], count: 0}, mesmo com datas e status válidos e dados no banco. Sem um
    // seletor explícito, assume "todos" como padrão.
    if (!filter.consorcioNome?.length && !filter.todosConsorcios && !filter.userIds?.length && !filter.todosVanzeiros) {
      filter = { ...filter, todosConsorcios: true, todosVanzeiros: true };
    }

    const dataInicio = filter.dataInicio.toISOString().split('T')[0];
    const dataFim = filter.dataFim.toISOString().split('T')[0];

    // Favorecido escolhido + consorcio (regra de Rayanne, 2026-11-11): so o favorecido, dentro do
    // consorcio, como a Movimentacao Financeira - nao a uniao das visoes de favorecido e consorcio.
    const favorecidoNoConsorcio = Boolean(filter.favorecidoNoConsorcio) && !filter.todosVanzeiros && Boolean(filter.userIds?.length)
      && (Boolean(filter.consorcioNome?.length) || Boolean(filter.todosConsorcios));
    const consorciosEscolhidos = (filter.consorcioNome ?? []).map((c) => c.trim().toUpperCase().replace(/'/g, `''`)).join(`','`);
    // Eleicao + todos os consorcios nao corta pela lista (ver o filtro de consorcio abaixo).
    const consorcioDoFavorecidoEleicao = favorecidoNoConsorcio && !filter.todosConsorcios
      ? ` AND UPPER(TRIM(${eleicaoConsorcioFiltroCase('op')})) IN('${consorciosEscolhidos}') ` : ``;
    // STUC: mesmo CASE e mesma lista da Movimentacao Financeira (CONSORCIO_CASE, CONSORCIOS em maiusculas).
    const consorcioDoFavorecidoStuc = !favorecidoNoConsorcio ? `` : filter.todosConsorcios
      ? ` AND UPPER(TRIM(${this.consorcioCaseSimples})) IN('${this.CONSORCIOS.map((c) => c.toUpperCase()).join(`','`)}') `
      : ` AND UPPER(TRIM(${this.consorcioCaseSimples})) IN('${consorciosEscolhidos}') `;
    // Desativados no STUC, como a Movimentacao Financeira: sem o flag, bloqueado fica de fora; com ele, so bloqueados.
    const condicaoBloqueadoStuc = filter.desativados ? ` AND pu."bloqueado" = true ` : ` AND (pu."bloqueado" IS NULL OR pu."bloqueado" = false) `;

    let queryAPagarConsorcios = ``;

    let queryAPagarVanzeiros = ``;

    let queryConsorcios = ``;

    let queryVanzeiros = ``;

    let queryAPagarEleicaoConsorcio = ``;

    let queryAPagarEleicaoVanzeiro = ``;

    let queryEleicaoConsorcio = ``;

    let queryEleicaoVanzeiro = ``;

    let queryPendentesConsorcio = ``;

    let queryPendentesVanzeiro = ``;

    // Pendência Paga sai do grupo "histórico" (dataVencimento) pra ter data de pagamento própria
    // (ver getQueryPendenciaPagaConsorcios/Vanzeiros).
    let queryPendenciaPagaConsorcios = ``;

    let queryPendenciaPagaVanzeiros = ``;

    // PASSO 0 (ver getQueryPendenciaPagaPasso0Consorcios/Vanzeiros): filhas pagas nunca enviadas
    // em arquivo próprio, invisíveis para queryPendenciaPagaConsorcios/Vanzeiros (que exigem
    // detalhe_a da própria filha).
    let queryPendenciaPagaPasso0Consorcios = ``;

    let queryPendenciaPagaPasso0Vanzeiros = ``;

    // ---- Quais grupos de consulta o filtro de status pede ----
    // aPagar:    ordens da janela atual ainda sem pagamento.
    // atrasadas: "OPs atrasadas" (ordens antigas sem agrupamento). Não existem na modalidade Eleição.
    // historico: pagamentos já remetidos (detalhe_a), filtrados por statusRemessa / motivoStatusRemessa.
    const semFiltroStatus = !(
      filter.aPagar || filter.pendentes || filter.erro || filter.pago || filter.emProcessamento
      || filter.pendenciaPaga || filter.rejeitado || filter.estorno
    );
    const temEleicao = !!filter.eleicao;
    const querAPagar = semFiltroStatus || !!filter.aPagar;
    const querAtrasadas = !temEleicao && (semFiltroStatus || !!filter.pendentes || !!filter.erro);
    // ADR 0017 (revisado): "A Pagar" também precisa do histórico (statusRemessa IN (0,1)), não só
    // da consulta de ordens nunca agrupadas acima - é a união das duas populações.
    const querHistorico = semFiltroStatus || !!(
      filter.pago || filter.emProcessamento || filter.pendenciaPaga || filter.rejeitado || filter.estorno || filter.erro || filter.aPagar
    );

    if (querAPagar) {
      queryAPagarConsorcios = this.getQueryApagarConsorcios(dataInicio, dataFim, true);
      queryAPagarVanzeiros = this.getQueryApagarVanzeiros(dataInicio, dataFim, true);
      queryAPagarEleicaoConsorcio = this.getQueryApagarEleicaoConsorcio(dataInicio, dataFim);
      queryAPagarEleicaoVanzeiro = this.getQueryApagarEleicaoVanzeiro(dataInicio, dataFim);
    }
    if (querAtrasadas) {
      queryPendentesConsorcio = this.getQueryApagarConsorcios(dataInicio, dataFim, undefined, true);
      queryPendentesVanzeiro = this.getQueryApagarVanzeiros(dataInicio, dataFim, undefined, true);
    }
    if (querHistorico) {
      queryConsorcios = this.getQueryConsorcios(dataInicio, dataFim);
      queryVanzeiros = this.getQueryVanzeiros(dataInicio, dataFim);
      queryEleicaoConsorcio = this.getQueryEleicaoConsorcio(dataInicio, dataFim);
      queryEleicaoVanzeiro = this.getQueryEleicaoVanzeiro(dataInicio, dataFim);
    }
    if (filter.pendenciaPaga) {
      queryPendenciaPagaConsorcios = this.getQueryPendenciaPagaConsorcios(dataInicio, dataFim);
      queryPendenciaPagaVanzeiros = this.getQueryPendenciaPagaVanzeiros(dataInicio, dataFim);
      queryPendenciaPagaPasso0Consorcios = this.getQueryPendenciaPagaPasso0Consorcios(dataInicio, dataFim);
      queryPendenciaPagaPasso0Vanzeiros = this.getQueryPendenciaPagaPasso0Vanzeiros(dataInicio, dataFim);
    }

    // Só acrescenta um trecho a uma consulta que existe (evita sobrar "AND ..." solto no UNION).
    const anexar = (query: string, trecho: string) => (query === `` ? query : query + trecho);

    //Tipo de pesquisa: filter.todosVanzeiros,filter.todosConsorcios,filter.consorcioNome,filter.userIds
    if ((filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros) {
      if (!filter.todosVanzeiros) {
        const userPlaceholders = (filter.userIds ?? []).map((id) => Number(id)).join(`','`);
        // No histórico o favorecido pode vir da ordem do próprio agrupado (pu) ou da ordem do agrupado
        // "pai" (puu, pendência paga); filtrar só por pu escondia esses pagamentos.
        queryVanzeiros = anexar(queryVanzeiros, ` AND (pu."id" IN('${userPlaceholders}') OR puu."id" IN('${userPlaceholders}')) `);
        const usersVanzeiros = ` AND pu."id" IN('${userPlaceholders}') `;
        queryAPagarVanzeiros = anexar(queryAPagarVanzeiros, usersVanzeiros);
        queryAPagarEleicaoVanzeiro = anexar(queryAPagarEleicaoVanzeiro, usersVanzeiros);
        queryPendentesVanzeiro = anexar(queryPendentesVanzeiro, usersVanzeiros);
        queryEleicaoVanzeiro = anexar(queryEleicaoVanzeiro, usersVanzeiros + consorcioDoFavorecidoEleicao);
        queryAPagarEleicaoVanzeiro = anexar(queryAPagarEleicaoVanzeiro, consorcioDoFavorecidoEleicao);
        queryPendenciaPagaVanzeiros = anexar(queryPendenciaPagaVanzeiros, usersVanzeiros);
        queryPendenciaPagaPasso0Vanzeiros = anexar(queryPendenciaPagaPasso0Vanzeiros, usersVanzeiros);
      } else {
        const consorcioPlaceholders = this.MODAIS.join(`','`);
        queryPendentesVanzeiro = anexar(queryPendentesVanzeiro, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11`);
        queryVanzeiros = anexar(queryVanzeiros, ` AND (op."nomeConsorcio" IN('${consorcioPlaceholders}') or opp."nomeConsorcio" IN('${consorcioPlaceholders}'))
                            AND (length(op."operadoraCpfCnpj")<=11  or length(opp."operadoraCpfCnpj")<=11) `);
        queryAPagarVanzeiros = anexar(queryAPagarVanzeiros, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11`);
        // ordem_pagamento_unico (Eleição) não tem "nomeConsorcio": a coluna é "consorcio".
        queryAPagarEleicaoVanzeiro = anexar(queryAPagarEleicaoVanzeiro, ` AND op."consorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11 `);
        queryPendenciaPagaVanzeiros = anexar(queryPendenciaPagaVanzeiros, ` AND (op."nomeConsorcio" IN('${consorcioPlaceholders}') or opp."nomeConsorcio" IN('${consorcioPlaceholders}'))
                            AND (length(op."operadoraCpfCnpj")<=11  or length(opp."operadoraCpfCnpj")<=11) `);
        // PASSO 0 não tem "opp" (a filha, por definição, não tem filhas próprias - agrupamentoSemFilhas).
        queryPendenciaPagaPasso0Vanzeiros = anexar(queryPendenciaPagaPasso0Vanzeiros, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11`);
      }
    }

    // queryAPagarEleicaoConsorcio/queryEleicaoConsorcio correm sobre ordem_pagamento_unico
    // (alias "op"), cuja coluna de consórcio é "consorcio" - não "nomeConsorcio", que só existe
    // em ordem_pagamento (usada pelas demais sub-queries abaixo).
    if ((filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios) {
      if (!filter.todosConsorcios) {
        // Sem distinção de acento ou maiúsculas (ver @ApiQuery em RelatorioNovoRemessaController).
        const consorcioPlaceholders = filter.consorcioNome?.map((c) => c.trim().toUpperCase()).join(`','`);
        queryAPagarConsorcios = anexar(queryAPagarConsorcios, ` AND UPPER(TRIM(${this.consorcioCaseSimples})) IN('${consorcioPlaceholders}') `);
        queryConsorcios = anexar(queryConsorcios, ` AND UPPER(TRIM(${this.consorcioCaseDuplo})) IN('${consorcioPlaceholders}') `);
        queryAPagarEleicaoConsorcio = anexar(queryAPagarEleicaoConsorcio, ` AND UPPER(TRIM(${eleicaoConsorcioFiltroCase('op')})) IN('${consorcioPlaceholders}') `);
        queryEleicaoConsorcio = anexar(queryEleicaoConsorcio, ` AND UPPER(TRIM(${eleicaoConsorcioFiltroCase('op')})) IN('${consorcioPlaceholders}') `);
        queryPendentesConsorcio = anexar(queryPendentesConsorcio, ` AND UPPER(TRIM(${this.consorcioCaseSimples})) IN('${consorcioPlaceholders}') `);
        queryPendenciaPagaConsorcios = anexar(queryPendenciaPagaConsorcios, ` AND UPPER(TRIM(${this.consorcioCaseDuplo})) IN('${consorcioPlaceholders}') `);
        queryPendenciaPagaPasso0Consorcios = anexar(queryPendenciaPagaPasso0Consorcios, ` AND UPPER(TRIM(${this.consorcioCaseSimples})) IN('${consorcioPlaceholders}') `);
      } else {
        const consorcioPlaceholders = this.CONSORCIOS.join(`','`);
        queryAPagarConsorcios = anexar(queryAPagarConsorcios, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `);
        queryConsorcios = anexar(queryConsorcios, ` AND (op."nomeConsorcio" IN('${consorcioPlaceholders}') or opp."nomeConsorcio" IN('${consorcioPlaceholders}')) ${this.excluiCnpjConsorcioInstitucional} `);
        // Eleição + "Todos": o total da Eleição, sem cortar pela lista (regra de Rayanne, 2026-11-11),
        // igual à Movimentação Financeira. O "consorcio" gravado na ordem de Eleição muitas vezes não é
        // o do favorecido (STPC/STPL/TEC vêm do permitCode) e a lista deixava esses pagamentos de fora.
        queryPendentesConsorcio = anexar(queryPendentesConsorcio, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `);
        queryPendenciaPagaConsorcios = anexar(queryPendenciaPagaConsorcios, ` AND (op."nomeConsorcio" IN('${consorcioPlaceholders}') or opp."nomeConsorcio" IN('${consorcioPlaceholders}')) ${this.excluiCnpjConsorcioInstitucional} `);
        // PASSO 0 não tem "opp" (ver comentário acima).
        queryPendenciaPagaPasso0Consorcios = anexar(queryPendenciaPagaPasso0Consorcios, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `);
      }
    }

    // Filtro de status do histórico: status (remessa) e motivo (rejeitado/estorno) se somam com OR,
    // sempre dentro de um único grupo entre parênteses.
    //   Aguardando = 2 | Pago = 3 | Pendência paga = 5 | Pendência de pagamento (Todos) = 4
    //   Rejeitado = statusRemessa 4 com motivo != 02 | Estorno = motivo 02
    const status: number[] = [];
    const subErroStatus: string[] = [];

    // "Aguardando Pagamento" é só statusRemessa=2: statusRemessa IN (0,1) é "A Pagar" no
    // STATUS_CASE (query-builder compartilhado) - um estado diferente do "A pagar" desta tela
    // (consulta própria, ordens ainda sem agrupamento). Incluir 1 aqui fazia "Aguardando
    // Pagamento" devolver linhas que o próprio sistema rotula como "A Pagar" (confirmado em
    // produção: 1.326 linhas com statusRemessa=1 em 15-23/10/2026).
    if (filter.emProcessamento) status.push(2);
    if (filter.pago) status.push(3);
    if (filter.erro) status.push(4);
    // Pendência Paga (status 5) NÃO entra aqui: tem sua própria consulta por data de pagamento
    // (queryPendenciaPagaConsorcios/Vanzeiros) em vez do filtro de dataVencimento usado abaixo.
    // "Todos" da pendência de pagamento inclui sempre o que Rejeitado e Estorno trazem.
    if (filter.estorno || filter.erro) subErroStatus.push('02');
    // ADR 0017 (revisado): "A Pagar" é a união de ordens nunca agrupadas (consulta própria,
    // queryApagarConsorcios/Vanzeiros, controlada por querAPagar) com o bucket cru "A Pagar" do
    // STATUS_CASE (statusRemessa IN (0,1), já enviado aguardando retorno do banco) - mesma
    // definição usada pela Movimentação Financeira e por STUC-Gratuidade (que só tem este
    // bucket, por nascer já agrupada - ADR 0004). Entra aqui para alimentar queryConsorcios/
    // Vanzeiros e queryEleicaoConsorcio/Vanzeiro via condicoesStatus/condicoesStatusPendencia
    // abaixo.
    if (filter.aPagar) status.push(0, 1);

    const statusStuc = status;

    // Rejeitado: no mundo real o motivo não é uma lista fixa (AL/HO/ANHO/AM/AJ/AR/... -
    // confirmado em produção), e o STATUS_CASE classifica como Rejeitado qualquer motivo != '02'
    // quando statusRemessa=4 (seu ELSE). Um filtro baseado só em "motivo IN (lista fixa)", sem
    // exigir statusRemessa=4, tinha dois problemas ao mesmo tempo: perdia motivos fora da lista
    // (ex.: 113 linhas com motivo='AM' em statusRemessa=4) e incluía por engano linhas Pago/
    // Pendência Paga que coincidem em motivo (ex.: 1.278 linhas com statusRemessa=3 e
    // motivo='AL', rotuladas "Pago" pelo STATUS_CASE).
    const condicaoRejeitado = (filter.rejeitado || filter.erro)
      ? `(oph."statusRemessa" = 4 AND (oph."motivoStatusRemessa" IS NULL OR oph."motivoStatusRemessa" <> '02'))`
      : null;

    const condicoesStatus: string[] = [];
    if (subErroStatus.length > 0) {
      // O motivo (ex.: '02') fica gravado no histórico mesmo depois que o agrupamento é quitado como pendência (status 3/5).
      // Só conta o que ainda não foi pago: o próprio histórico não pode estar pago e o agrupamento (ou o seu pai) não pode
      // ter outro histórico pago. Mesma regra da procedure de pendentes; sem isso o relatório inflava a Pendência de Pagamento.
      condicoesStatus.push(
        `(oph."motivoStatusRemessa" IN (${subErroStatus.map((s) => `'${s}'`).join(',')})` +
          ` AND oph."statusRemessa" NOT IN (3,5)` +
          ` AND NOT EXISTS (SELECT 1 FROM ordem_pagamento_agrupado_historico hp_pago` +
          ` WHERE hp_pago."statusRemessa" IN (3,5)` +
          ` AND (hp_pago."ordemPagamentoAgrupadoId" = oph."ordemPagamentoAgrupadoId"` +
          ` OR hp_pago."ordemPagamentoAgrupadoId" = (SELECT ag_pai."ordemPagamentoAgrupadoId" FROM ordem_pagamento_agrupado ag_pai WHERE ag_pai."id" = oph."ordemPagamentoAgrupadoId"))))`,
      );
    }
    if (status.length > 0) {
      condicoesStatus.push(`oph."statusRemessa" IN (${status.join(',')})`);
    }
    if (condicaoRejeitado) condicoesStatus.push(condicaoRejeitado);

    // Pendência de Pagamento (Todos), Rejeitado e Estorno seguem as MESMAS regras da procedure de pendentes
    // (queries/regras-pendencia.ts): só aparece o que seria pago de novo. O motivo 02 (Estorno) e os demais (Rejeitado)
    // são subconjuntos dessa mesma regra. Pago/Aguardando continuam filtrando só por status.
    const pendenciaElegivel = pendenciaRejeitadaPermissionario({ oph: 'oph', da: 'da', opa: 'opafi', users: ['pu', 'puu'] });
    const condicoesStatusPendencia: string[] = [];
    if (filter.estorno || filter.erro) condicoesStatusPendencia.push(`(${pendenciaElegivel} AND oph."motivoStatusRemessa" = '02')`);
    if (filter.rejeitado || filter.erro) condicoesStatusPendencia.push(`(${pendenciaElegivel} AND oph."motivoStatusRemessa" <> '02')`);
    const statusSemErro = status.filter((st) => st !== 4);
    if (statusSemErro.length > 0) condicoesStatusPendencia.push(`oph."statusRemessa" IN (${statusSemErro.join(',')})`);

    if (condicoesStatusPendencia.length > 0) {
      const filtroStatusPendencia = ` AND (${condicoesStatusPendencia.join(' OR ')}) `;
      queryConsorcios = anexar(queryConsorcios, filtroStatusPendencia);
      queryVanzeiros = anexar(queryVanzeiros, filtroStatusPendencia);
    }
    if (condicoesStatus.length > 0) {
      // Eleição (ordem_pagamento_unico) tem outro modelo de dados: mantém o filtro por status/motivo.
      const filtroStatus = ` AND (${condicoesStatus.join(' OR ')}) `;
      queryEleicaoConsorcio = anexar(queryEleicaoConsorcio, filtroStatus);
      queryEleicaoVanzeiro = anexar(queryEleicaoVanzeiro, filtroStatus);
    }

    // STUC - Gratuidade: fonte de dados separada (valorGratuidade / agrupamento de gratuidade),
    // mutuamente exclusiva com Eleição/Desativados/Pendentes na UI (ADR 0004). Isolado dos
    // blocos acima para não arriscar a lógica já existente: reaproveita buildStucGratuidadeQuery
    // (query builder compartilhada, estilo bind params $1..$5) substituindo os placeholders por
    // literais, já que este repository monta toda a SQL por interpolação de string.
    let queryStucGratuidadeVanzeiro = ``;
    let queryStucGratuidadeConsorcio = ``;

    // STUC - Gratuidade "Pendência Paga": mesmo motivo do "A pagar" acima - precisa da sua
    // própria consulta por data de pagamento (buildStucGratuidadePendenciaPagaSingleDateQuery,
    // espelhando getQueryPendenciaPagaConsorcios/Vanzeiros do fluxo normal), já que dataVencimento
    // não reflete a data real do pagamento.
    let queryStucPendenciaPagaVanzeiro = ``;
    let queryStucPendenciaPagaConsorcio = ``;

    // STUC - Gratuidade "Pendência de Pagamento" (Estorno/Rejeitado) em dia único: espelha
    // Movimentação Financeira (resolveStatuses/buildFinalBaseQuery), que só troca para a consulta
    // ciente de cadeia de retentativa (buildStucGratuidadePendenciaPagamentoSingleDateQuery, usa
    // op_pai."dataPagamento" para achar a tentativa certa) quando De === Até. Fora desse caso, o
    // filtro de data abaixo (BETWEEN) já cobre o intervalo via dataVencimento sem precisar da
    // cadeia de retentativa - manter o comportamento existente para intervalos.
    const isSingleDate = dataInicio === dataFim;
    let queryStucPendenciaPagamentoVanzeiro = ``;
    let queryStucPendenciaPagamentoConsorcio = ``;

    if (filter.stucGratuidade) {
      // Em dia único, Estorno/Rejeitado migra para queryStucPendenciaPagamentoVanzeiro/Consorcio
      // (abaixo): sem excluí-los daqui, as mesmas linhas entrariam duas vezes.
      const condicoesStucRejeitadoSingleDate = isSingleDate;
      const buildStucGratuidadeLiteral = (): string => {
        // $3/$4/$5 aparecem duas vezes cada em buildStucGratuidadeQuery (uma com o cast
        // ::integer[]/::text[], outra solta dentro do "= ANY($N)" do mesmo OR) - as duas
        // precisam ser substituídas, senão sobra um placeholder de bind sem valor correspondente.
        let literal = buildStucGratuidadeQuery({ consorcioFilterParamIndex: 5 })
          .replace(/\$1/g, `'${dataInicio}'`)
          .replace(/\$2/g, `'${dataFim}'`)
          .replace(/\$3/g, 'NULL::integer[]')
          .replace(/\$4/g, 'NULL::text[]')
          .replace(/\$5/g, 'NULL::text[]') + condicaoBloqueadoStuc;
        // Mesma combinação OR do fluxo normal (condicoesStatus/filtroStatus acima) - usar AND aqui
        // tornava "Pendência de Pagamento" (Todos) bem mais restritivo para STUC do que para o
        // fluxo normal, e divergia da Movimentação Financeira (que classifica pelo status
        // computado via STATUS_CASE, cujo ELSE cobre motivo fora da lista, ex.: 'AR').
        // statusRemessa=4 ("Pendência de Pagamento"/Todos) sozinho já cobre Estorno E Rejeitado
        // (motivo='02' ou não) - em dia único precisa sair daqui junto com subErroStatus/
        // condicaoRejeitado, senão as linhas que migraram para a consulta ciente de retentativa
        // (abaixo) voltam a entrar também por esta condição mais ampla.
        const statusStucSemRejeitado = condicoesStucRejeitadoSingleDate ? statusStuc.filter((s) => s !== 4) : statusStuc;
        const condicoesStuc: string[] = [];
        if (subErroStatus.length > 0 && !condicoesStucRejeitadoSingleDate) condicoesStuc.push(`oph."motivoStatusRemessa" IN (${subErroStatus.map((s) => `'${s}'`).join(',')})`);
        if (statusStucSemRejeitado.length > 0) condicoesStuc.push(`oph."statusRemessa" IN (${statusStucSemRejeitado.join(',')})`);
        if (condicaoRejeitado && !condicoesStucRejeitadoSingleDate) condicoesStuc.push(condicaoRejeitado);
        // filter.pendenciaPaga (status 5) nunca entra em statusStuc/subErroStatus/condicaoRejeitado
        // (tem consulta própria por data de pagamento, queryStucPendenciaPagaVanzeiro/Consorcio,
        // igual ao fluxo normal) - mas é, ainda assim, um status pedido. Sem contar com ele aqui,
        // "Pendência Paga" sozinha (STUC não tem agrupamento "sem pai" para esse status, então
        // nenhuma linha realmente corresponde) caía no mesmo buraco do comentário abaixo: nenhuma
        // condição de status aplicada, devolvendo TODOS os status desta consulta (achado
        // 2026-11-06, testando contra produção: Pendência Paga devolvia o mesmo total de "Todos").
        const tinhaFiltroDeStatus = subErroStatus.length > 0 || statusStuc.length > 0 || !!condicaoRejeitado || !!filter.pendenciaPaga;
        if (condicoesStuc.length > 0) {
          literal += ` AND (${condicoesStuc.join(' OR ')}) `;
        } else if (tinhaFiltroDeStatus) {
          // Único status pedido era Estorno/Rejeitado (migrou inteiro para a consulta de dia
          // único, ciente de retentativa) ou Pendência Paga (tem consulta própria, ver acima) -
          // sem isto, a ausência de condição aqui faria esta consulta devolver TODOS os status.
          literal += ` AND FALSE `;
        }
        return literal;
      };

      if ((filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros) {
        let literal = buildStucGratuidadeLiteral();
        if (!filter.todosVanzeiros) {
          const userPlaceholders = filter.userIds?.join(`','`);
          literal += ` AND pu."id" IN('${userPlaceholders}') ${consorcioDoFavorecidoStuc}`;
        } else {
          const consorcioPlaceholders = this.MODAIS.join(`','`);
          literal += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11 `;
        }
        queryStucGratuidadeVanzeiro = `SELECT nomes AS "nome", "nomeConsorcio" AS "nome2", "dataReferencia", "dataPagamento", "cpfCnpj", valor AS valor FROM (${literal}) q`;
      }

      if (((filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios) && !favorecidoNoConsorcio) {
        let literal = buildStucGratuidadeLiteral();
        if (!filter.todosConsorcios) {
          // filter.consorcioNome vem direto da query string (sem validação de charset) e é
          // interpolado num literal SQL - escapa aspas simples para não permitir sair do IN(...).
          const consorcioPlaceholders = filter.consorcioNome?.map((c) => c.trim().toUpperCase().replace(/'/g, `''`)).join(`','`);
          literal += ` AND UPPER(TRIM(${this.consorcioCaseSimples})) IN('${consorcioPlaceholders}') `;
        } else {
          const consorcioPlaceholders = this.CONSORCIOS.join(`','`);
          literal += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `;
          // MODAIS (STPC/STPL/TEC) é subconjunto de CONSORCIOS. Quando a busca "todos" roda os
          // dois ramos (nenhum favorecido/consórcio específico selecionado), a fatia CPF de
          // MODAIS já vem pelo ramo de vanzeiro (abaixo) - sem excluí-la aqui ela soma em
          // dobro (ver PR de correção do valor total zerado, mesma raiz: os dois ramos do STUC
          // retornam linha por vanzeiro, não há linha agregada por consórcio que justifique a
          // dedup aplicada no fluxo normal).
          if (filter.todosVanzeiros) {
            const modaisPlaceholders = this.MODAIS.join(`','`);
            literal += ` AND NOT (op."nomeConsorcio" IN('${modaisPlaceholders}') AND length(op."operadoraCpfCnpj")<=11) `;
          }
        }
        queryStucGratuidadeConsorcio = `SELECT nomes AS "nome", "nomeConsorcio" AS "nome2", "dataReferencia", "dataPagamento", "cpfCnpj", valor AS valor FROM (${literal}) q`;
      }

      if (filter.pendenciaPaga) {
        const buildStucPendenciaPagaLiteral = (): string =>
          buildStucGratuidadePendenciaPagaSingleDateQuery({ consorcioFilterParamIndex: 5 })
            .replace(/\$1/g, `'${dataInicio}'`)
            .replace(/\$2/g, `'${dataFim}'`)
            .replace(/\$3/g, 'NULL::integer[]')
            .replace(/\$4/g, 'NULL::text[]')
            .replace(/\$5/g, 'NULL::text[]') + condicaoBloqueadoStuc;

        if ((filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros) {
          let literal = buildStucPendenciaPagaLiteral();
          if (!filter.todosVanzeiros) {
            const userPlaceholders = filter.userIds?.join(`','`);
            literal += ` AND pu."id" IN('${userPlaceholders}') ${consorcioDoFavorecidoStuc}`;
          } else {
            const consorcioPlaceholders = this.MODAIS.join(`','`);
            literal += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11 `;
          }
          queryStucPendenciaPagaVanzeiro = `SELECT nomes AS "nome", "nomeConsorcio" AS "nome2", "dataReferencia", "dataPagamento", "cpfCnpj", valor AS valor FROM (${literal}) q`;
        }

        if (((filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios) && !favorecidoNoConsorcio) {
          let literal = buildStucPendenciaPagaLiteral();
          if (!filter.todosConsorcios) {
            const consorcioPlaceholders = filter.consorcioNome?.map((c) => c.trim().toUpperCase().replace(/'/g, `''`)).join(`','`);
            literal += ` AND UPPER(TRIM(${this.consorcioCaseSimples})) IN('${consorcioPlaceholders}') `;
          } else {
            const consorcioPlaceholders = this.CONSORCIOS.join(`','`);
            literal += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `;
            if (filter.todosVanzeiros) {
              const modaisPlaceholders = this.MODAIS.join(`','`);
              literal += ` AND NOT (op."nomeConsorcio" IN('${modaisPlaceholders}') AND length(op."operadoraCpfCnpj")<=11) `;
            }
          }
          queryStucPendenciaPagaConsorcio = `SELECT nomes AS "nome", "nomeConsorcio" AS "nome2", "dataReferencia", "dataPagamento", "cpfCnpj", valor AS valor FROM (${literal}) q`;
        }
      }

      // Pendência de Pagamento (Estorno/Rejeitado) em dia único: mesma consulta ciente de cadeia
      // de retentativa que a Movimentação Financeira usa (buildStucGratuidadePendenciaPagamentoSingleDateQuery),
      // para não perder/colapsar dias de uma janela STUC cuja tentativa mais recente não é do
      // próprio dia filtrado. Fora do dia único, buildStucGratuidadeLiteral acima já cobre.
      const parentErrorStatuses: Array<'Estorno' | 'Rejeitado'> = [];
      if (filter.estorno || filter.erro) parentErrorStatuses.push('Estorno');
      if (filter.rejeitado || filter.erro) parentErrorStatuses.push('Rejeitado');

      if (isSingleDate && parentErrorStatuses.length > 0) {
        const buildStucPendenciaPagamentoLiteral = (): string =>
          buildStucGratuidadePendenciaPagamentoSingleDateQuery({ consorcioFilterParamIndex: 5, parentErrorStatuses })
            .replace(/\$1/g, `'${dataInicio}'`)
            .replace(/\$2/g, `'${dataFim}'`)
            .replace(/\$3/g, 'NULL::integer[]')
            .replace(/\$4/g, 'NULL::text[]')
            .replace(/\$5/g, 'NULL::text[]') + condicaoBloqueadoStuc;

        if ((filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros) {
          let literal = buildStucPendenciaPagamentoLiteral();
          if (!filter.todosVanzeiros) {
            const userPlaceholders = filter.userIds?.join(`','`);
            literal += ` AND pu."id" IN('${userPlaceholders}') ${consorcioDoFavorecidoStuc}`;
          } else {
            const consorcioPlaceholders = this.MODAIS.join(`','`);
            literal += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11 `;
          }
          queryStucPendenciaPagamentoVanzeiro = `SELECT nomes AS "nome", "nomeConsorcio" AS "nome2", "dataReferencia", "dataPagamento", "cpfCnpj", valor AS valor FROM (${literal}) q`;
        }

        if (((filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios) && !favorecidoNoConsorcio) {
          let literal = buildStucPendenciaPagamentoLiteral();
          if (!filter.todosConsorcios) {
            const consorcioPlaceholders = filter.consorcioNome?.map((c) => c.trim().toUpperCase().replace(/'/g, `''`)).join(`','`);
            literal += ` AND UPPER(TRIM(${this.consorcioCaseSimples})) IN('${consorcioPlaceholders}') `;
          } else {
            const consorcioPlaceholders = this.CONSORCIOS.join(`','`);
            literal += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `;
            if (filter.todosVanzeiros) {
              const modaisPlaceholders = this.MODAIS.join(`','`);
              literal += ` AND NOT (op."nomeConsorcio" IN('${modaisPlaceholders}') AND length(op."operadoraCpfCnpj")<=11) `;
            }
          }
          queryStucPendenciaPagamentoConsorcio = `SELECT nomes AS "nome", "nomeConsorcio" AS "nome2", "dataReferencia", "dataPagamento", "cpfCnpj", valor AS valor FROM (${literal}) q`;
        }
      }
    }

    // Desativados na Eleicao, como a Movimentacao Financeira: so os favorecidos bloqueados.
    if (filter.desativados) {
      const soBloqueados = (query: string) => query.split(`(pu."bloqueado" is null OR pu."bloqueado" = false)`).join(`pu."bloqueado" = true`);
      queryEleicaoConsorcio = soBloqueados(queryEleicaoConsorcio);
      queryEleicaoVanzeiro = soBloqueados(queryEleicaoVanzeiro);
      queryAPagarEleicaoConsorcio = soBloqueados(queryAPagarEleicaoConsorcio);
      queryAPagarEleicaoVanzeiro = soBloqueados(queryAPagarEleicaoVanzeiro);
    }

    const hasQuery = queryAPagarConsorcios !== `` || queryAPagarVanzeiros !== `` || queryConsorcios !== `` || queryVanzeiros !== ``
      || queryAPagarEleicaoConsorcio !== `` || queryAPagarConsorcios !== `` || queryEleicaoConsorcio !== `` || queryAPagarEleicaoVanzeiro !== ``
      || queryPendentesConsorcio !== `` || queryPendentesVanzeiro !== ``
      || queryStucPendenciaPagamentoVanzeiro !== `` || queryStucPendenciaPagamentoConsorcio !== ``
      || queryPendenciaPagaConsorcios !== `` || queryPendenciaPagaVanzeiros !== ``
      || queryPendenciaPagaPasso0Consorcios !== `` || queryPendenciaPagaPasso0Vanzeiros !== ``
      || queryStucGratuidadeVanzeiro !== `` || queryStucGratuidadeConsorcio !== ``
      || queryStucPendenciaPagaVanzeiro !== `` || queryStucPendenciaPagaConsorcio !== ``;
    if (!hasQuery) {
      return new RelatorioConsolidadoNovoRemessaDto({
        data: [],
        count: 0,
        valor: 0
      });
    }

    const params: any[] = [];
    let paramIndex = 1;

    const queries: string[] = [];

    const temFiltroConsorcio = (filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios;
    const temFiltroVanzeiros = (filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros;

    // Se não marcou nenhum dos dois, é busca geral = busca os dois
    const buscarConsorcio = (temFiltroConsorcio || !temFiltroVanzeiros) && !favorecidoNoConsorcio;
    const buscarVanzeiro = temFiltroVanzeiros || !temFiltroConsorcio;

    if (filter.stucGratuidade) {
      if (queryStucGratuidadeConsorcio) queries.push(queryStucGratuidadeConsorcio);
      if (queryStucGratuidadeVanzeiro) queries.push(queryStucGratuidadeVanzeiro);
      if (queryStucPendenciaPagaConsorcio) queries.push(queryStucPendenciaPagaConsorcio);
      if (queryStucPendenciaPagaVanzeiro) queries.push(queryStucPendenciaPagaVanzeiro);
      if (queryStucPendenciaPagamentoConsorcio) queries.push(queryStucPendenciaPagamentoConsorcio);
      if (queryStucPendenciaPagamentoVanzeiro) queries.push(queryStucPendenciaPagamentoVanzeiro);
    } else {
      if (querAPagar) {
        if (buscarConsorcio) queries.push(temEleicao ? queryAPagarEleicaoConsorcio : queryAPagarConsorcios);
        if (buscarVanzeiro) queries.push(temEleicao ? queryAPagarEleicaoVanzeiro : queryAPagarVanzeiros);
      }

      if (querAtrasadas) {
        if (buscarConsorcio) queries.push(queryPendentesConsorcio);
        if (buscarVanzeiro) queries.push(queryPendentesVanzeiro);
      }

      if (querHistorico) {
        // Sem isso, com só Pendência Paga marcada (nenhum outro status, condicoesStatus vazio),
        // queryConsorcios/queryVanzeiros rodariam sem filtro de status nenhum e trariam TODOS os
        // status dentro do vencimento - a Pendência Paga tem sua consulta própria logo abaixo.
        const incluiVencimento = semFiltroStatus || condicoesStatus.length > 0;
        if (incluiVencimento) {
          if (buscarConsorcio) queries.push(temEleicao ? queryEleicaoConsorcio : queryConsorcios);
          if (buscarVanzeiro) queries.push(temEleicao ? queryEleicaoVanzeiro : queryVanzeiros);
        }
        // Pendência Paga não tem uma variante própria de Eleição (nenhuma getQueryEleicaoPendenciaPaga*
        // existe, diferente do par queryEleicaoConsorcio/Vanzeiro acima) - sem este guard, Eleição +
        // Pendência Paga misturava pagamentos do fluxo normal (via op_pai, sem relação com
        // ordem_pagamento_unico) na resposta, em vez de não trazer nada (achado testando contra
        // produção/dump 19/10/2026: a consulta final nem continha "ordem_pagamento_unico").
        if (!temEleicao) {
          if (buscarConsorcio) queries.push(queryPendenciaPagaConsorcios);
          if (buscarVanzeiro) queries.push(queryPendenciaPagaVanzeiros);
          // PASSO 0 segue a mesma Eleição-guard: sem a Eleição selecionada, sempre que a
          // Pendência Paga normal entra.
          if (buscarConsorcio) queries.push(queryPendenciaPagaPasso0Consorcios);
          if (buscarVanzeiro) queries.push(queryPendenciaPagaPasso0Vanzeiros);
        }
      }
    }

    // Junta só as queries que realmente existem
    const parts = queries.filter(q => q !== ``);

    let query = ``;

    if (parts.length === 0) {
      // nada pra buscar
      return new RelatorioConsolidadoNovoRemessaDto({
        data: [],
        count: 0,
        valor: 0,
      });
    }

    // STUC - Gratuidade (ADR 0012): cada linha deixa de ser "um favorecido somando o período"
    // e passa a ser "uma janela de pagamento" (até 4 dias) - agregação e paginação próprias,
    // os demais filtros continuam com o GROUP BY "nome" original abaixo, intocado.
    if (filter.stucGratuidade) {
      return this.findConsolidadoStucGratuidade(parts, filter);
    }

    query = `${this.cteFilhasRepresentantes}SELECT "nome", SUM("valor") AS "valor" FROM (${parts.join(' UNION ALL ')}) AS R WHERE  (R."nome" is not null AND R."nome2" is not null)  `;

    query += ` GROUP BY "nome" `;

    // valor: filter.valorMin, filter.valorMax
    if (filter.valorMin !== undefined && filter.valorMax !== undefined) {
      query += ` HAVING SUM(valor) between $${paramIndex++} AND $${paramIndex++}`;
      params.push(filter.valorMin, filter.valorMax);
    } else if (filter.valorMin !== undefined) {
      query += ` HAVING SUM(valor) >= $${paramIndex++}`;
      params.push(filter.valorMin);
    } else if (filter.valorMax !== undefined) {
      query += `HAVING SUM(valor) <= $${paramIndex++}`;
      params.push(filter.valorMax);
    }

    query += ` ORDER BY "nome" ASC `;

    // Um favorecido individual de STPC/STPL/TEC aparece tanto na linha agregada do consórcio
    // quanto na linha individual de vanzeiro. Quando o filtro de consórcio cobre todo o MODAIS
    // (todosConsorcios, que inclui STPC/STPL/TEC), a linha individual já está contida no total
    // do consórcio e não deve ser somada de novo no valor geral — mas continua aparecendo em "data".
    const consorciosLabels = new Set<string>(this.CONSORCIOS);
    const consorcioCobreModais = !!filter.todosConsorcios
      || !!filter.consorcioNome?.some((nome) => this.MODAIS.includes(nome));
    // STUC - Gratuidade não tem uma linha agregada por consórcio (queryStucGratuidadeConsorcio
    // também rotula "nome" com o nome do vanzeiro, não do consórcio - ver buildStucGratuidadeLiteral
    // acima), então a dedup abaixo não se aplica: sem ela, todo valor é descartado como duplicado.
    const podeTerDuplicidade = !!filter.todosVanzeiros && consorcioCobreModais && !filter.stucGratuidade;

    // Com filtro de valor (HAVING SUM(valor) acima), a suposição "a linha do consórcio sempre
    // está presente junto com a da vanzeiro" quebra: o HAVING filtra cada grupo ("nome")
    // independentemente, então um consórcio pode ficar de fora do resultado enquanto a vanzeiro
    // que ele cobre passa (ou vice-versa). Descontar a vanzeiro sem o consórcio correspondente
    // realmente presente em "rows" zerava o total mesmo com linhas reais (achado 2026-11-06: com
    // valor máximo ou faixa, nenhum consórcio - cuja soma do período é sempre grande - sobrevive
    // ao filtro, só vanzeiros pequenos sobram, e a dedup os descontava do total mesmo assim).
    const somarValorSemDuplicidade = (rows: { nome: string; valor: any }[]) => {
      const algumConsorcioPresente = podeTerDuplicidade && rows.some((r) => consorciosLabels.has(r.nome));
      return rows.reduce((acc: number, curr: { nome: string; valor: any }) => {
        const eDuplicidadeVanzeiroModal = algumConsorcioPresente && !consorciosLabels.has(curr.nome);
        return eDuplicidadeVanzeiroModal ? acc : acc + parseFloat(String(curr.valor));
      }, 0);
    };

    const hasPagination = filter.page !== undefined && filter.pageSize !== undefined;
    const baseParams = [...params];

    let paginatedQuery = query;

    if (hasPagination) {
      const page = filter.page as number;
      const pageSize = filter.pageSize as number;
      const offset = (page - 1) * pageSize;
      paginatedQuery = `SELECT *, COUNT(*) OVER() AS "totalCount" FROM (${query}) AS P LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(pageSize, offset);
    }

    this.logger.debug(`Executing query: ${paginatedQuery} with params: ${params.join(', ')}`, RelatorioNovoRemessaConsolidadoRepository.name);

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    let result: any[];
    let valorTotal = 0;

    try {
      result = await queryRunner.query(paginatedQuery, params);

      if (hasPagination) {
        const totalRows = await queryRunner.query(query, baseParams);
        valorTotal = somarValorSemDuplicidade(totalRows);
      }
    } finally {
      await queryRunner.release();
    }

    const mappedResults = result.map((r) => {
      const elem = new RelatorioConsolidadoNovoRemessaData();
      elem.nomefavorecido = r.nome;
      elem.valor = parseFloat(String(r.valor));
      return elem;
    });

    const totalCount = hasPagination
      ? (result.length > 0 ? parseInt(String(result[0].totalCount), 10) : 0)
      : mappedResults.length;

    const valor = hasPagination
      ? valorTotal
      : somarValorSemDuplicidade(result);

    return new RelatorioConsolidadoNovoRemessaDto({
      data: mappedResults,
      count: totalCount,
      valor,
    });
  }

  private async findConsolidadoStucGratuidade(
    parts: string[],
    filter: IFindPublicacaoRelatorioNovoRemessa,
  ): Promise<RelatorioConsolidadoNovoRemessaDto> {
    const query = `SELECT "nome", "cpfCnpj", "dataReferencia", "dataPagamento", SUM("valor") AS "valor" FROM (${parts.join(' UNION ALL ')}) AS R WHERE (R."nome" IS NOT NULL AND R."nome2" IS NOT NULL) GROUP BY "nome", "cpfCnpj", "dataReferencia", "dataPagamento"`;

    this.logger.debug(`Executing query: ${query}`, RelatorioNovoRemessaConsolidadoRepository.name);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let rawRows: any[];
    try {
      rawRows = await queryRunner.query(query, []);
    } finally {
      await queryRunner.release();
    }

    const dayRows = rawRows.map((r: any) => ({
      nome: r.nome as string,
      cpfCnpj: (r.cpfCnpj ?? null) as string | null,
      valor: parseFloat(String(r.valor)),
      // pg retorna "dataReferencia"/"dataPagamento" (colunas timestamp) como Date nativo, não
      // como string - parse() do date-fns exige string e produz Invalid Date se receber um
      // Date já pronto.
      dataReferencia: r.dataReferencia instanceof Date ? r.dataReferencia : parse(r.dataReferencia, 'dd/MM/yyyy', new Date()),
      dataPagamento: r.dataPagamento instanceof Date || r.dataPagamento == null
        ? r.dataPagamento
        : parse(r.dataPagamento, 'dd/MM/yyyy', new Date()),
    }));

    let pivoted = pivotStucGratuidadeRows(dayRows, (row) => `${row.nome}::${row.cpfCnpj}`);

    // valorMin/valorMax sobre o total do favorecido no periodo, nao sobre cada janela (regra de
    // Rayanne, 2026-11-11) - mesma regra da Movimentacao Financeira (filtrarPeloTotalDoFavorecido).
    pivoted = filtrarPeloTotalDoFavorecido(pivoted, (row) => `${row.nome}::${row.cpfCnpj}`, filter.valorMin, filter.valorMax);
    // Total depois do filtro de valor, como a lista (antes somava as linhas brutas e ignorava o filtro).
    const valorTotal = pivoted.reduce((acc, row) => acc + Number(row.valor), 0);

    pivoted = [...pivoted].sort((a, b) => {
      const porNome = a.nome.localeCompare(b.nome);
      if (porNome !== 0) return porNome;
      const dataA = a.dataPagamento ? a.dataPagamento.getTime() : 0;
      const dataB = b.dataPagamento ? b.dataPagamento.getTime() : 0;
      return dataA - dataB;
    });

    const hasPagination = filter.page !== undefined && filter.pageSize !== undefined;
    const totalCount = pivoted.length;
    const pageRows = hasPagination
      ? pivoted.slice(
          ((filter.page as number) - 1) * (filter.pageSize as number),
          ((filter.page as number) - 1) * (filter.pageSize as number) + (filter.pageSize as number),
        )
      : pivoted;

    const data = pageRows.map(
      (row) =>
        new RelatorioConsolidadoNovoRemessaData({
          nomefavorecido: row.nome,
          cpfCnpj: row.cpfCnpj,
          valor: row.valor,
          dataOrdemPagamento1: row.dataOrdemPagamento1 ? format(row.dataOrdemPagamento1, 'dd/MM/yyyy') : null,
          valorOrdemPagamento1: row.valorOrdemPagamento1,
          dataOrdemPagamento2: row.dataOrdemPagamento2 ? format(row.dataOrdemPagamento2, 'dd/MM/yyyy') : null,
          valorOrdemPagamento2: row.valorOrdemPagamento2,
          dataOrdemPagamento3: row.dataOrdemPagamento3 ? format(row.dataOrdemPagamento3, 'dd/MM/yyyy') : null,
          valorOrdemPagamento3: row.valorOrdemPagamento3,
          dataOrdemPagamento4: row.dataOrdemPagamento4 ? format(row.dataOrdemPagamento4, 'dd/MM/yyyy') : null,
          valorOrdemPagamento4: row.valorOrdemPagamento4,
          dataPagamento: row.dataPagamento ? format(row.dataPagamento, 'dd/MM/yyyy') : null,
        }),
    );

    return new RelatorioConsolidadoNovoRemessaDto({
      data,
      count: totalCount,
      valor: valorTotal,
    });
  }

  getDataMinima(hoje = new Date()) {
    const dia = hoje.getDay(); // 0=Dom, 2=Ter, 6=Sab
    const data = new Date(hoje);
    data.setHours(0, 0, 0, 0);

    // TERÇA, QUARTA, QUINTA -> mínima é TERÇA
    if ([2, 3, 4].includes(dia)) {
      data.setDate(data.getDate() - (dia - 2));
      return data;
    }

    // SEXTA ,SÁBADO, DOMINGO, SEGUNDA -> mínima é SEXTA
    if ([6, 0, 1, 5].includes(dia)) {
      let diff = 0;
      if (dia === 0) diff = 1; // Dom -> volta 1
      if (dia === 1) diff = 2; // Seg -> volta 2
      if (dia === 5) diff = 3; // Seg -> volta 3
      data.setDate(data.getDate() - diff);
      return data;
    }
  }

  getDataMaxima(hoje = new Date()) {
    const dia = hoje.getDay();
    const minima = this.getDataMinima(hoje);
    if (!minima) return null;

    const maxima = new Date(minima);

    if ([2, 3, 4].includes(dia)) {
      // Terça -> Quarta
      maxima.setDate(minima.getDate() + 1);
    } else if ([6, 0, 1].includes(dia)) {
      // Sábado -> Segunda
      maxima.setDate(minima.getDate() + 2);
    }

    maxima.setHours(23, 59, 59, 999);
    return maxima;
  }
}
