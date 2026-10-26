import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { format, parse } from 'date-fns';
import { CustomLogger } from 'src/utils/custom-logger';
import { buildStucGratuidadeQuery, buildStucGratuidadePendenciaPagaSingleDateQuery, buildStucGratuidadePendenciaPagamentoSingleDateQuery } from './queries/novo-remessa-query-builder';
import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { pivotStucGratuidadeRows } from '../utils/stuc-gratuidade-pivot';


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

  private readonly consorcioCaseEleicao = `CASE
    WHEN pu."permitCode" = '8' THEN 'VLT'
    WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
    WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
    WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
    ELSE op."consorcio"
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

  private readonly fromQueryPrincipal = ` from detalhe_a da
                                          left join ordem_pagamento_agrupado_historico oph on oph."id"=da."ordemPagamentoAgrupadoHistoricoId"
                                          left join ordem_pagamento_agrupado opafi on opafi."id"=oph."ordemPagamentoAgrupadoId"
                                          left join ordem_pagamento_agrupado opai on opai."ordemPagamentoAgrupadoId"=oph."ordemPagamentoAgrupadoId"
                                          left join ordem_pagamento op on op."ordemPagamentoAgrupadoId"=opafi.id
                                          left join public.user pu on pu."id"=op."userId"
                                          left join ordem_pagamento opp on opp."ordemPagamentoAgrupadoId"=opai.id
                                          left join public.user puu on puu."id"=opp."userId" `;

  // Mesmo fromQueryPrincipal, com o join a mais pro agrupamento "pai" (op_pai) que a Pendência
  // Paga precisa: quando o agrupamento da linha tem pai, a data de pagamento real é a do pai, não
  // a dele mesmo (mesma regra de opa."ordemPagamentoAgrupadoId" / op_pai do query-builder
  // compartilhado - ver getQueryPendenciaPagaConsorcios/Vanzeiros).
  private readonly fromQueryPrincipalComPai = this.fromQueryPrincipal +
    ` left join ordem_pagamento_agrupado op_pai on op_pai."id"=opafi."ordemPagamentoAgrupadoId" `;

  private readonly fromQueryEleicaoAPagar = ` from ordem_pagamento_unico op 
                                             left join public.user pu on pu."cpfCnpj"=op."operadoraCpfCnpj" `

  private readonly fromQueryEleicao = ` from detalhe_a da
                                        left join ordem_pagamento_agrupado_historico oph on oph."id"=da."ordemPagamentoAgrupadoHistoricoId"
                                        left join ordem_pagamento_agrupado opa on opa."id"=oph."ordemPagamentoAgrupadoId"
                                        left join ordem_pagamento_unico op on op."idOrdemPagamento"=opa."id"::varchar
                                        left join public.user pu on pu."cpfCnpj"=op."operadoraCpfCnpj" `;


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
      where += ` where (op."ordemPagamentoAgrupadoId" is null) and (pu."bloqueado" is null OR pu."bloqueado" = false)
               and op."dataCaptura" >= '${dataInicio}'::date AND op."dataCaptura" < '${dataFim}'::date + interval '1 day'`;

    }
    return where;
  }

  private getQueryApagarEleicaoConsorcio(dataInicio: string, dataFim: string): string {
    return ` ${this.headerQueryEleicaoConsorcioApagar}
             ${this.fromQueryEleicaoAPagar}
             where op."dataOrdem" BETWEEN '${dataInicio}' AND '${dataFim}' AND op."idOrdemPagamento" is null`;
  }

  private getQueryApagarEleicaoVanzeiro(dataInicio: string, dataFim: string): string {
    return ` ${this.headerQueryEleicaoVanzereiroApagar}
             ${this.fromQueryEleicaoAPagar}
             where op."dataOrdem" BETWEEN '${dataInicio}' AND '${dataFim}' AND op."idOrdemPagamento" is null`;
  }

  // NOT EXISTS/motivoStatusRemessa: mesmos guards de getQueryPendenciaPagaConsorcios/Vanzeiros
  // (ADR 0011) - sem eles, agrupamentos substituídos/reenviados entravam na consulta; o SELECT
  // DISTINCT (nome, nome2, valor, idLinha) e o filtro externo "nome IS NOT NULL" descartavam
  // essas linhas por acidente (o join opafi/opai/opp resulta em nome/nome2 nulos nesses casos),
  // não por design.
  private readonly excluiAgrupamentoSubstituido = `
               and NOT EXISTS (SELECT 1 FROM ordem_pagamento_agrupado filha WHERE filha."ordemPagamentoAgrupadoId" = opafi.id)
               and (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)`;

  private getQueryConsorcios(dataInicio: string, dataFim: string): string {
    return `   ${this.headerQueryConsorcios}
               ${this.fromQueryPrincipal}
               where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day'
               ${this.excluiAgrupamentoSubstituido} `;
  }

  private getQueryVanzeiros(dataInicio: string, dataFim: string): string {
    return `  ${this.headerQueryVanzeiros}
              ${this.fromQueryPrincipal}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day'
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
  private getQueryPendenciaPagaConsorcios(dataInicio: string, dataFim: string): string {
    return `   ${this.headerQueryConsorcios}
               ${this.fromQueryPrincipalComPai}
               where oph."statusRemessa" = 5
                 and (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
                 and NOT EXISTS (SELECT 1 FROM ordem_pagamento_agrupado filha WHERE filha."ordemPagamentoAgrupadoId" = opafi.id)
                 and (
                   (opafi."ordemPagamentoAgrupadoId" is not null and op_pai."dataPagamento"::date BETWEEN '${dataInicio}'::date AND '${dataFim}'::date)
                   or
                   (opafi."ordemPagamentoAgrupadoId" is null and opafi."dataPagamento"::date BETWEEN '${dataInicio}'::date AND '${dataFim}'::date)
                 ) `;
  }

  private getQueryPendenciaPagaVanzeiros(dataInicio: string, dataFim: string): string {
    return `  ${this.headerQueryVanzeiros}
              ${this.fromQueryPrincipalComPai}
              where oph."statusRemessa" = 5
                and (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
                and NOT EXISTS (SELECT 1 FROM ordem_pagamento_agrupado filha WHERE filha."ordemPagamentoAgrupadoId" = opafi.id)
                and (
                  (opafi."ordemPagamentoAgrupadoId" is not null and op_pai."dataPagamento"::date BETWEEN '${dataInicio}'::date AND '${dataFim}'::date)
                  or
                  (opafi."ordemPagamentoAgrupadoId" is null and opafi."dataPagamento"::date BETWEEN '${dataInicio}'::date AND '${dataFim}'::date)
                ) `;
  }

  private getQueryEleicaoConsorcio(dataInicio: string, dataFim: string): string {
    return `  ${this.headerQueryEleicaoConsorcio}
              ${this.fromQueryEleicao}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day' `;
  }

  private getQueryEleicaoVanzeiro(dataInicio: string, dataFim: string): string {
    return `  ${this.headerQueryEleicaoVanzeiro}
              ${this.fromQueryEleicao}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day' `;
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
    const querHistorico = semFiltroStatus || !!(
      filter.pago || filter.emProcessamento || filter.pendenciaPaga || filter.rejeitado || filter.estorno || filter.erro
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
        queryEleicaoVanzeiro = anexar(queryEleicaoVanzeiro, usersVanzeiros);
        queryPendenciaPagaVanzeiros = anexar(queryPendenciaPagaVanzeiros, usersVanzeiros);
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
        queryAPagarEleicaoConsorcio = anexar(queryAPagarEleicaoConsorcio, ` AND UPPER(TRIM(${this.consorcioCaseEleicao})) IN('${consorcioPlaceholders}') `);
        queryEleicaoConsorcio = anexar(queryEleicaoConsorcio, ` AND UPPER(TRIM(${this.consorcioCaseEleicao})) IN('${consorcioPlaceholders}') `);
        queryPendentesConsorcio = anexar(queryPendentesConsorcio, ` AND UPPER(TRIM(${this.consorcioCaseSimples})) IN('${consorcioPlaceholders}') `);
        queryPendenciaPagaConsorcios = anexar(queryPendenciaPagaConsorcios, ` AND UPPER(TRIM(${this.consorcioCaseDuplo})) IN('${consorcioPlaceholders}') `);
      } else {
        const consorcioPlaceholders = this.CONSORCIOS.join(`','`);
        queryAPagarConsorcios = anexar(queryAPagarConsorcios, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `);
        queryConsorcios = anexar(queryConsorcios, ` AND (op."nomeConsorcio" IN('${consorcioPlaceholders}') or opp."nomeConsorcio" IN('${consorcioPlaceholders}')) `);
        queryAPagarEleicaoConsorcio = anexar(queryAPagarEleicaoConsorcio, ` AND op."consorcio" IN('${consorcioPlaceholders}') `);
        queryEleicaoConsorcio = anexar(queryEleicaoConsorcio, ` AND op."consorcio" IN('${consorcioPlaceholders}') `);
        queryPendentesConsorcio = anexar(queryPendentesConsorcio, ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `);
        queryPendenciaPagaConsorcios = anexar(queryPendenciaPagaConsorcios, ` AND (op."nomeConsorcio" IN('${consorcioPlaceholders}') or opp."nomeConsorcio" IN('${consorcioPlaceholders}')) `);
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

    // "A pagar" para STUC - Gratuidade: diferente do fluxo normal (que usa uma consulta separada
    // de ordens ainda sem agrupamento, queryApagarConsorcios/Vanzeiros), a gratuidade já nasce
    // agrupada (ADR 0004) - não existe um estado "sem agrupamento" equivalente. "A pagar" mapeia
    // então para o bucket cru "A Pagar" do STATUS_CASE (statusRemessa 0/1), igual à Movimentação
    // Financeira. Cópia à parte de "status": sem isso, "A pagar" (filter.aPagar) passaria a
    // filtrar também queryConsorcios/Vanzeiros do fluxo normal, que não usa esse bucket hoje.
    const statusStuc = filter.aPagar ? [...status, 0, 1] : status;

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
      condicoesStatus.push(`oph."motivoStatusRemessa" IN (${subErroStatus.map((s) => `'${s}'`).join(',')})`);
    }
    if (status.length > 0) {
      condicoesStatus.push(`oph."statusRemessa" IN (${status.join(',')})`);
    }
    if (condicaoRejeitado) condicoesStatus.push(condicaoRejeitado);

    if (condicoesStatus.length > 0) {
      const filtroStatus = ` AND (${condicoesStatus.join(' OR ')}) `;
      queryConsorcios = anexar(queryConsorcios, filtroStatus);
      queryVanzeiros = anexar(queryVanzeiros, filtroStatus);
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
          .replace(/\$5/g, 'NULL::text[]');
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
        const tinhaFiltroDeStatus = subErroStatus.length > 0 || statusStuc.length > 0 || !!condicaoRejeitado;
        if (condicoesStuc.length > 0) {
          literal += ` AND (${condicoesStuc.join(' OR ')}) `;
        } else if (tinhaFiltroDeStatus) {
          // Único status pedido era Estorno/Rejeitado e migrou inteiro para a consulta de dia
          // único (abaixo, ciente de retentativa) - sem isto, a ausência de condição aqui faria
          // esta consulta devolver TODOS os status, não nada.
          literal += ` AND FALSE `;
        }
        return literal;
      };

      if ((filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros) {
        let literal = buildStucGratuidadeLiteral();
        if (!filter.todosVanzeiros) {
          const userPlaceholders = filter.userIds?.join(`','`);
          literal += ` AND pu."id" IN('${userPlaceholders}') `;
        } else {
          const consorcioPlaceholders = this.MODAIS.join(`','`);
          literal += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11 `;
        }
        queryStucGratuidadeVanzeiro = `SELECT nomes AS "nome", "nomeConsorcio" AS "nome2", "dataReferencia", "dataPagamento", "cpfCnpj", valor AS valor FROM (${literal}) q`;
      }

      if ((filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios) {
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
            .replace(/\$5/g, 'NULL::text[]');

        if ((filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros) {
          let literal = buildStucPendenciaPagaLiteral();
          if (!filter.todosVanzeiros) {
            const userPlaceholders = filter.userIds?.join(`','`);
            literal += ` AND pu."id" IN('${userPlaceholders}') `;
          } else {
            const consorcioPlaceholders = this.MODAIS.join(`','`);
            literal += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11 `;
          }
          queryStucPendenciaPagaVanzeiro = `SELECT nomes AS "nome", "nomeConsorcio" AS "nome2", "dataReferencia", "dataPagamento", "cpfCnpj", valor AS valor FROM (${literal}) q`;
        }

        if ((filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios) {
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
            .replace(/\$5/g, 'NULL::text[]');

        if ((filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros) {
          let literal = buildStucPendenciaPagamentoLiteral();
          if (!filter.todosVanzeiros) {
            const userPlaceholders = filter.userIds?.join(`','`);
            literal += ` AND pu."id" IN('${userPlaceholders}') `;
          } else {
            const consorcioPlaceholders = this.MODAIS.join(`','`);
            literal += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11 `;
          }
          queryStucPendenciaPagamentoVanzeiro = `SELECT nomes AS "nome", "nomeConsorcio" AS "nome2", "dataReferencia", "dataPagamento", "cpfCnpj", valor AS valor FROM (${literal}) q`;
        }

        if ((filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios) {
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

    const hasQuery = queryAPagarConsorcios !== `` || queryAPagarVanzeiros !== `` || queryConsorcios !== `` || queryVanzeiros !== ``
      || queryAPagarEleicaoConsorcio !== `` || queryAPagarConsorcios !== `` || queryEleicaoConsorcio !== `` || queryAPagarEleicaoVanzeiro !== ``
      || queryPendentesConsorcio !== `` || queryPendentesVanzeiro !== ``
      || queryStucPendenciaPagamentoVanzeiro !== `` || queryStucPendenciaPagamentoConsorcio !== ``
      || queryPendenciaPagaConsorcios !== `` || queryPendenciaPagaVanzeiros !== ``
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
    const buscarConsorcio = temFiltroConsorcio || !temFiltroVanzeiros;
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
        if (buscarConsorcio) queries.push(queryPendenciaPagaConsorcios);
        if (buscarVanzeiro) queries.push(queryPendenciaPagaVanzeiros);
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

    query = `SELECT "nome", SUM("valor") AS "valor" FROM (${parts.join(' UNION ALL ')}) AS R WHERE  (R."nome" is not null AND R."nome2" is not null)  `;

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
    const vanzeiroJaIncluidoNoConsorcio = !!filter.todosVanzeiros && consorcioCobreModais && !filter.stucGratuidade;

    const somarValorSemDuplicidade = (rows: { nome: string; valor: any }[]) =>
      rows.reduce((acc: number, curr: { nome: string; valor: any }) => {
        const eDuplicidadeVanzeiroModal = vanzeiroJaIncluidoNoConsorcio && !consorciosLabels.has(curr.nome);
        return eDuplicidadeVanzeiroModal ? acc : acc + parseFloat(String(curr.valor));
      }, 0);

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

    const valorTotal = rawRows.reduce((acc: number, r: any) => acc + parseFloat(String(r.valor)), 0);

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

    const { valorMin, valorMax } = filter;
    if (valorMin !== undefined && valorMax !== undefined) {
      pivoted = pivoted.filter((row) => row.valor >= valorMin && row.valor <= valorMax);
    } else if (valorMin !== undefined) {
      pivoted = pivoted.filter((row) => row.valor >= valorMin);
    } else if (valorMax !== undefined) {
      pivoted = pivoted.filter((row) => row.valor <= valorMax);
    }

    pivoted = [...pivoted].sort((a, b) => a.nome.localeCompare(b.nome));

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
