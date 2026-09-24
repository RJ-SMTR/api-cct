import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioFinancialMovementNovoRemessaData, RelatorioFinancialMovementNovoRemessaPageDto } from '../dtos/relatorio-financial-and-movement.dto';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import { buildCodigoErroSql } from './queries/descricao-erro';
import { STATUS_CASE } from './queries/novo-remessa-query-builder';


type NormalizedFilter = IFindPublicacaoRelatorioNovoFinancialMovement & {
  dataInicio: Date;
  dataFim: Date;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class RelatorioNovoRemessaMovimentacaoRepository {
  private readonly logger = new CustomLogger(RelatorioNovoRemessaMovimentacaoRepository.name, { timestamp: true });

  private readonly MODAIS = ['STPC', 'STPL', 'TEC'];

  private readonly CONSORCIOS = ['VLT', 'Intersul', 'Transcarioca', 'Internorte', 'MobiRio', 'Santa Cruz', 'MOBI-Rio BUM', 'TUSE', 'STPC', 'STPL', 'TEC'];

  private readonly headerQueryConsorciosApagar = ` select distinct TO_CHAR( op."dataOrdem"::date, 'DD/MM/YYYY')  AS "dataReferencia",
                                                    op."ordemPagamentoAgrupadoId" AS id,
                                                    pu."fullName" AS nomes,
                                                    pu.email,
                                                    pu."bankCode" AS "codBanco",
                                                    bc.name AS "nome Banco",
                                                    pu."cpfCnpj" AS "cpfCnpj",
                                                    CASE
                                                    WHEN pu."permitCode" = '8'  THEN 'VLT'
                                                      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                                      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                                      WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                                      ELSE op."nomeConsorcio"
                                                    END AS consorcio,
                                                    round(op."valor",2) AS valor,
                                                    null::text AS dataPagamento,
                                                   'A Pagar' AS status,
                                                  NULL::text AS "codigoErro"`;

  private readonly headerQueryConsorcios = ` select distinct TO_CHAR(da."dataVencimento"::date, 'DD/MM/YYYY') AS "dataReferencia",
                                                    oph."ordemPagamentoAgrupadoId" as id,
                                                    coalesce(pu."fullName", puu."fullName") AS nomes,
                                                    coalesce(pu."email",puu."email") as email,
                                                    coalesce(pu."bankCode",puu."bankCode") AS "codBanco",
                                                    coalesce(bc."name",bbc."name") AS "nome Banco",
                                                    coalesce(pu."cpfCnpj",puu."cpfCnpj") AS "cpfCnpj",
                                                    CASE
                                                      WHEN pu."permitCode" = '8' OR puu."permitCode" = '8' THEN 'VLT'
                                                      WHEN pu."permitCode" LIKE '4%' OR puu."permitCode" LIKE '4%' THEN 'STPC'
                                                      WHEN pu."permitCode" LIKE '81%' OR puu."permitCode" LIKE '81%' THEN 'STPL'
                                                      WHEN pu."permitCode" LIKE '7%' OR puu."permitCode" LIKE '7%' THEN 'TEC'
                                                      ELSE COALESCE(op."nomeConsorcio", opp."nomeConsorcio")
                                                    END AS consorcio,
                                                    da."valorLancamento" AS valor,
                                                    da."dataVencimento"::text AS dataPagamento,
                                                  CASE
                                                    WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
                                                    WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
                                                    WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
                                                    WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
                                                    WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
                                                    ELSE 'Rejeitado'
                                                  END AS status,
                                                  ${buildCodigoErroSql(STATUS_CASE)} AS "codigoErro"`;

  private readonly headerQueryVanzeirosAPagar = ` select distinct TO_CHAR( op."dataOrdem"::date, 'DD/MM/YYYY') AS "dataReferencia",
                                                    op."ordemPagamentoAgrupadoId" AS id,
                                                    pu."fullName" AS nomes,
                                                    pu.email,
                                                    pu."bankCode" AS "codBanco",
                                                    bc.name AS "nome Banco",
                                                    pu."cpfCnpj" AS "cpfCnpj",
                                                    CASE
                                                    WHEN pu."permitCode" = '8'  THEN 'VLT'
                                                      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                                      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                                      WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                                      ELSE op."nomeConsorcio"
                                                    END AS consorcio,
                                                    round(op."valor",2) AS valor,
                                                    null::text AS dataPagamento,
                                                   'A Pagar' AS status,
                                                  NULL::text AS "codigoErro"`;

  private readonly headerQueryVanzeiros = ` select distinct TO_CHAR(da."dataVencimento"::date, 'DD/MM/YYYY') AS "dataReferencia",
                                                    oph."ordemPagamentoAgrupadoId" as id,
                                                    coalesce(pu."fullName", puu."fullName") AS nomes,
                                                    coalesce(pu."email",puu."email") as email,
                                                    coalesce(pu."bankCode",puu."bankCode") AS "codBanco",
                                                    coalesce(bc."name",bbc."name") AS "nome Banco",
                                                    coalesce(pu."cpfCnpj",puu."cpfCnpj") AS "cpfCnpj",
                                                    CASE
                                                      WHEN pu."permitCode" = '8' OR puu."permitCode" = '8' THEN 'VLT'
                                                      WHEN pu."permitCode" LIKE '4%' OR puu."permitCode" LIKE '4%' THEN 'STPC'
                                                      WHEN pu."permitCode" LIKE '81%' OR puu."permitCode" LIKE '81%' THEN 'STPL'
                                                      WHEN pu."permitCode" LIKE '7%' OR puu."permitCode" LIKE '7%' THEN 'TEC'
                                                      ELSE COALESCE(op."nomeConsorcio", opp."nomeConsorcio")
                                                    END AS consorcio,
                                                    da."valorLancamento" AS valor,
                                                    da."dataVencimento"::text AS dataPagamento,
                                                  CASE
                                                    WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
                                                    WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
                                                    WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
                                                    WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
                                                    WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
                                                    ELSE 'Rejeitado'
                                                  END AS status,
                                                  ${buildCodigoErroSql(STATUS_CASE)} AS "codigoErro"`;

  private readonly headerQueryEleicaoVanzereiroApagar = ` select distinct TO_CHAR(op."dataOrdem"::date, 'DD/MM/YYYY') AS "dataReferencia",
                                                          op."ordemPagamentoAgrupadoId" AS id,
                                                          pu."fullName" AS nomes,
                                                          pu.email,
                                                          pu."bankCode" AS "codBanco",
                                                          bc.name AS "nome Banco",
                                                          pu."cpfCnpj" AS "cpfCnpj",
                                                          CASE
                                                          WHEN pu."permitCode" = '8'  THEN 'VLT'
                                                            WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                                            WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                                            WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                                            ELSE op."consorcio"
                                                          END AS consorcio,
                                                          round(op."valor",2) AS valor,
                                                          null::text AS dataPagamento,
                                                        'A Pagar' AS status,
                                                  NULL::text AS "codigoErro"`;


  private readonly headerQueryEleicaoConsorcioApagar = ` select distinct TO_CHAR(op."dataOrdem"::date, 'DD/MM/YYYY') AS "dataReferencia",
                                                            op."ordemPagamentoAgrupadoId" AS id,
                                                            pu."fullName" AS nomes,
                                                            pu.email,
                                                            pu."bankCode" AS "codBanco",
                                                            bc.name AS "nome Banco",
                                                            pu."cpfCnpj" AS "cpfCnpj",
                                                            CASE
                                                            WHEN pu."permitCode" = '8'  THEN 'VLT'
                                                              WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                                              WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                                              WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                                              ELSE op."consorcio"
                                                            END AS consorcio,
                                                            round(op."valor",2) AS valor,
                                                            null::text AS dataPagamento,
                                                          'A Pagar' AS status,
                                                  NULL::text AS "codigoErro"`;

  private readonly headerQueryEleicaoVanzeiro = ` select distinct TO_CHAR(da."dataVencimento"::date, 'DD/MM/YYYY') AS "dataReferencia",
                                                    oph."ordemPagamentoAgrupadoId" AS id,
                                                    pu."fullName" AS nomes,
                                                    pu."email" as email,
                                                    pu."bankCode" AS "codBanco",
                                                    bc."name" AS "nome Banco",
                                                    pu."cpfCnpj" AS "cpfCnpj",
                                                    CASE
                                                      WHEN pu."permitCode" = '8' THEN 'VLT'
                                                      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                                      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                                      WHEN pu."permitCode" LIKE '7%'  THEN 'TEC'
                                                      ELSE op."consorcio"
                                                    END AS consorcio,
                                                    da."valorLancamento" AS valor,
                                                    da."dataVencimento"::text AS dataPagamento,
                                                  CASE
                                                    WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
                                                    WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
                                                    WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
                                                    WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
                                                    WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
                                                    ELSE 'Rejeitado'
                                                  END AS status,
                                                  ${buildCodigoErroSql(STATUS_CASE)} AS "codigoErro"`;

  private readonly headerQueryEleicaoConsorcio = ` select distinct TO_CHAR(da."dataVencimento"::date, 'DD/MM/YYYY') AS "dataReferencia",
                                                    oph."ordemPagamentoAgrupadoId" AS id,
                                                    pu."fullName" AS nomes,
                                                    pu."email" as email,
                                                    pu."bankCode" AS "codBanco",
                                                    bc."name" AS "nome Banco",
                                                    pu."cpfCnpj" AS "cpfCnpj",
                                                    CASE
                                                      WHEN pu."permitCode" = '8' THEN 'VLT'
                                                      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                                      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                                      WHEN pu."permitCode" LIKE '7%'  THEN 'TEC'
                                                      ELSE op."consorcio"
                                                    END AS consorcio,
                                                    da."valorLancamento" AS valor,
                                                    da."dataVencimento"::text AS dataPagamento,
                                                  CASE
                                                    WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
                                                    WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
                                                    WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
                                                    WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
                                                    WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
                                                    ELSE 'Rejeitado'
                                                  END AS status,
                                                  ${buildCodigoErroSql(STATUS_CASE)} AS "codigoErro"`;

  private readonly fromQueryApagar = ` from ordem_pagamento op
                                        left join ordem_pagamento_agrupado opa  on op."ordemPagamentoAgrupadoId"=opa.id
                                        left join public.user pu on pu."id"=op."userId"	              
                                        left join ordem_pagamento_agrupado_historico oph on opa."id"= oph."ordemPagamentoAgrupadoId"
                                        left join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = oph.id
                                        left join bank bc on bc.code = pu."bankCode" `;

  private readonly fromQueryPrincipal = ` from detalhe_a da
                                          left join ordem_pagamento_agrupado_historico oph on oph."id"=da."ordemPagamentoAgrupadoHistoricoId"		 
                                          left join ordem_pagamento_agrupado opafi on opafi."id"=oph."ordemPagamentoAgrupadoId"
                                          left join ordem_pagamento_agrupado opai on opai."ordemPagamentoAgrupadoId"=oph."ordemPagamentoAgrupadoId"
                                          left join ordem_pagamento op on op."ordemPagamentoAgrupadoId"=opafi.id
                                          left join public.user pu on pu."id"=op."userId"
                                          left join ordem_pagamento opp on opp."ordemPagamentoAgrupadoId"=opai.id
                                          left join public.user puu on puu."id"=opp."userId"
                                          left join bank bc on bc.code = pu."bankCode"
                                          left join bank bbc on bbc.code = puu."bankCode" `;

  private readonly fromQueryEleicaoAPagar = ` from ordem_pagamento_unico op 
                                             left join public.user pu on pu."cpfCnpj"=op."operadoraCpfCnpj" 
                                             left join bank bc on bc.code = pu."bankCode"`

  private readonly fromQueryEleicao = ` from detalhe_a da
                                        left join ordem_pagamento_agrupado_historico oph on oph."id"=da."ordemPagamentoAgrupadoHistoricoId"
                                        left join ordem_pagamento_agrupado opa on opa."id"=oph."ordemPagamentoAgrupadoId"
                                        left join ordem_pagamento_unico op on op."idOrdemPagamento"=opa."id"::varchar
                                        left join public.user pu on pu."cpfCnpj"=op."operadoraCpfCnpj" 
                                        left join bank bc on bc.code = pu."bankCode" `;


  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  // Every consorcio selection matches by the same value it is filtered and grouped/labeled
  // by: STPC/STPL/TEC/VLT are derived from pu."permitCode" (same rule the header CASE
  // expressions use), everything else (Internorte, Santa Cruz, ...) has no permitCode rule —
  // its own row IS the raw nomeConsorcio/consorcio column, so that stays the match for those.
  // rawColumn differs for the "eleicao" branch (op."consorcio" instead of op."nomeConsorcio").
  private buildConsorcioMatchCondition(
    consorcioValues: string[],
    options: { includeSecondUser?: boolean; rawColumn?: string } = {},
  ): string {
    const { includeSecondUser = false, rawColumn = 'nomeConsorcio' } = options;

    const conditionByModal: Record<string, (column: string) => string> = {
      VLT: (column) => `${column}."permitCode" = '8'`,
      STPC: (column) => `${column}."permitCode" LIKE '4%'`,
      STPL: (column) => `${column}."permitCode" LIKE '81%'`,
      TEC: (column) => `${column}."permitCode" LIKE '7%'`,
    };
    const columns = includeSecondUser ? [`pu`, `puu`] : [`pu`];

    const clauses: string[] = [];
    const namedValues: string[] = [];

    consorcioValues.forEach((nome) => {
      const buildCondition = conditionByModal[nome.trim().toUpperCase()];
      if (buildCondition) {
        columns.forEach((column) => clauses.push(buildCondition(column)));
      } else {
        namedValues.push(nome);
      }
    });

    if (namedValues.length > 0) {
      const placeholders = namedValues.join(`','`);
      clauses.push(`op."${rawColumn}" IN('${placeholders}')`);
      if (includeSecondUser) {
        clauses.push(`opp."${rawColumn}" IN('${placeholders}')`);
      }
    }

    return `(${clauses.join(' OR ')})`;
  }

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
               and op."dataCaptura" >= '${dataInicio}'::date AND op."dataCaptura" < '${dataFim}'::date + interval '1 day' `;

    } else if (pendente) {
      if (dataMinima && (new Date(dataMinima.getDate() - 2)).getTime() < new Date(dataFim).getTime()) {
        dataMinima.setDate(dataMinima.getDate() - 2);
        dataFim = dataMinima.toISOString();
      }
      where += ` where (op."ordemPagamentoAgrupadoId" is null) and (pu."bloqueado" is null OR pu."bloqueado" = false)
               and op."dataCaptura" >= '${dataInicio}'::date AND op."dataCaptura" < '${dataFim}'::date + interval '1 day'`;

    }
    return where;
  }

  private getQueryApagarEleicaoConsorcio(dataInicio: String, dataFim: String): string {
    return ` ${this.headerQueryEleicaoConsorcioApagar}                    
             ${this.fromQueryEleicaoAPagar}               
             where op."dataOrdem" BETWEEN '${dataInicio}' AND '${dataFim}' and op."idOrdemPagamento" is null 
             and (pu."bloqueado" is null OR pu."bloqueado" = false) `;
  }

  private getQueryApagarEleicaoVanzeiro(dataInicio: String, dataFim: String): string {
    return ` ${this.headerQueryEleicaoVanzereiroApagar}                    
             ${this.fromQueryEleicaoAPagar}               
             where op."dataOrdem" BETWEEN '${dataInicio}' AND '${dataFim}' and op."idOrdemPagamento" is null 
             and (pu."bloqueado" is null OR pu."bloqueado" = false) `;
  }

  private getQueryConsorcios(dataInicio: String, dataFim: String): string {
    return `   ${this.headerQueryConsorcios}
               ${this.fromQueryPrincipal}
               where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day'
               and (pu."bloqueado" is null OR pu."bloqueado" = false) `;
  }

  private getQueryVanzeiros(dataInicio: String, dataFim: String): string {
    return `  ${this.headerQueryVanzeiros}
              ${this.fromQueryPrincipal}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day'
               and (pu."bloqueado" is null OR pu."bloqueado" = false) `;
  }

  private getQueryEleicaoConsorcio(dataInicio: String, dataFim: String): string {
    return `  ${this.headerQueryEleicaoConsorcio}
              ${this.fromQueryEleicao}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day' `;
  }

  private getQueryEleicaoVanzeiro(dataInicio: String, dataFim: String): string {
    return `  ${this.headerQueryEleicaoVanzeiro}
              ${this.fromQueryEleicao}
              where da."dataVencimento" >= '${dataInicio}'::date AND da."dataVencimento" < '${dataFim}'::date + interval '1 day' `;
  }

  public async findMovimentacao(filter: IFindPublicacaoRelatorioNovoFinancialMovement): Promise<RelatorioFinancialMovementNovoRemessaPageDto> {

    const safeFilter = this.normalizeFilter(filter);
    const { currentPage, pageSize, offset } = this.resolvePagination(safeFilter);

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

    let count = 0;
    let valorTotal:Number = 0;
    let valorPago:Number = 0;
    let valorRejeitado:Number = 0;
    let valorEstornado:Number = 0;
    let valorAguardandoPagamento:Number = 0;
    let valorAPagar:Number = 0;
    let valorPendente:Number = 0;
    let valorPendenciaPaga:Number = 0;

    //filtro principal 
    //data: filter.dataInicio,filter.dataFim    
    if (filter.aPagar === undefined && filter.emProcessamento === undefined && filter.pago === undefined
      && filter.erro === undefined && filter.eleicao == undefined && filter.pendentes == undefined 
      && filter.rejeitado === undefined && filter.estorno === undefined) {
      queryAPagarConsorcios += this.getQueryApagarConsorcios(dataInicio, dataFim, true);
      queryPendentesConsorcio += this.getQueryApagarConsorcios(dataInicio, dataFim, undefined, true);
      queryAPagarVanzeiros += this.getQueryApagarVanzeiros(dataInicio, dataFim, true);
      queryPendentesVanzeiro += this.getQueryApagarVanzeiros(dataInicio, dataFim, undefined, true);
      queryAPagarEleicaoConsorcio += this.getQueryApagarEleicaoConsorcio(dataInicio, dataFim);
      queryAPagarEleicaoVanzeiro += this.getQueryApagarEleicaoVanzeiro(dataInicio, dataFim);
      queryConsorcios += this.getQueryConsorcios(dataInicio, dataFim);
      queryVanzeiros += this.getQueryVanzeiros(dataInicio, dataFim);
      queryEleicaoConsorcio += this.getQueryEleicaoConsorcio(dataInicio, dataFim);
      queryEleicaoVanzeiro += this.getQueryEleicaoVanzeiro(dataInicio, dataFim);
    }

    if (filter.aPagar || filter.pendentes || (filter.erro && !filter.rejeitado && !filter.estorno)) {
      queryAPagarConsorcios += this.getQueryApagarConsorcios(dataInicio, dataFim, true);
      queryPendentesConsorcio += this.getQueryApagarConsorcios(dataInicio, dataFim, undefined, true);
      queryAPagarVanzeiros += this.getQueryApagarVanzeiros(dataInicio, dataFim, true);
      queryPendentesVanzeiro += this.getQueryApagarVanzeiros(dataInicio, dataFim, undefined, true);
      queryAPagarEleicaoConsorcio += this.getQueryApagarEleicaoConsorcio(dataInicio, dataFim);
      queryAPagarEleicaoVanzeiro += this.getQueryApagarEleicaoVanzeiro(dataInicio, dataFim);
    }

    if (filter.emProcessamento || filter.pago ||filter.rejeitado || filter.estorno || filter.erro || filter.eleicao) {
      queryConsorcios += this.getQueryConsorcios(dataInicio, dataFim);
      queryVanzeiros += this.getQueryVanzeiros(dataInicio, dataFim);
      queryEleicaoConsorcio += this.getQueryEleicaoConsorcio(dataInicio, dataFim);
      queryEleicaoVanzeiro += this.getQueryEleicaoVanzeiro(dataInicio, dataFim);
    }

    //Tipo de pesquisa: filter.todosVanzeiros,filter.todosConsorcios,filter.consorcioNome,filter.userIds    
    if ((filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros) {
      if (!filter.todosVanzeiros) {
        const userPlaceholders = filter.userIds?.join(`','`);
        const usersVanzeiros = ` AND pu."id" IN('${userPlaceholders}') `
        queryAPagarVanzeiros += usersVanzeiros;
        queryVanzeiros += usersVanzeiros;
        queryAPagarEleicaoVanzeiro += usersVanzeiros;
        queryPendentesVanzeiro += usersVanzeiros;
        queryEleicaoVanzeiro += usersVanzeiros;
      } else {
        const consorcioPlaceholders = this.MODAIS.join(`','`);
        queryPendentesVanzeiro += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11`;
        queryVanzeiros += ` AND (op."nomeConsorcio" IN('${consorcioPlaceholders}') or opp."nomeConsorcio" IN('${consorcioPlaceholders}')) 
                            AND (length(op."operadoraCpfCnpj")<=11  or length(opp."operadoraCpfCnpj")<=11) `;
        queryAPagarVanzeiros += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11`;
        queryAPagarEleicaoVanzeiro += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11 `;
      }
    }

    const hasExplicitConsorcio = Boolean(filter.consorcioNome && filter.consorcioNome.length > 0);
    // Any consorcio selection — a modal (STPC/STPL/TEC/VLT), a real consórcio (Internorte,
    // Santa Cruz...), a mix, or "Todos" — shows one grouped row per date/status from here on.
    const isGroupedConsorcioSelection = hasExplicitConsorcio || Boolean(filter.todosConsorcios);

    if (hasExplicitConsorcio || filter.todosConsorcios) {
      // Whatever was selected is filtered and grouped/labeled by the exact same value:
      // permitCode for the modais (same rule the header CASE uses to derive "consorcio"),
      // the raw nomeConsorcio/consorcio column for everything else — that IS their own row,
      // there is no permitCode rule for a named consórcio.
      const consorcioValues = hasExplicitConsorcio ? filter.consorcioNome! : this.CONSORCIOS;

      queryAPagarConsorcios += ` AND ${this.buildConsorcioMatchCondition(consorcioValues)} `;
      queryConsorcios += ` AND ${this.buildConsorcioMatchCondition(consorcioValues, { includeSecondUser: true })} `;
      queryAPagarEleicaoConsorcio += ` AND ${this.buildConsorcioMatchCondition(consorcioValues)} `;
      queryEleicaoConsorcio += ` AND ${this.buildConsorcioMatchCondition(consorcioValues, { rawColumn: 'consorcio' })} `;
      queryPendentesConsorcio += ` AND ${this.buildConsorcioMatchCondition(consorcioValues)} `;
    }

    //status: filter.aPagar, filter.pago, filter.emProcessamento ,filter.erro
    //sub-fltros 
    // substatus: filter.error
    //      filter.estorno,filter.rejeitado
    // filter.pago: 
    //    filter.pendenciaPaga

    const status: number[] = [];
    const subErroStatus: string[] = [];

    if (filter.emProcessamento){ 
      status.push(1);
      status.push(2);
    }
    if (filter.pago) status.push(3);
    if (filter.erro) status.push(4);
    if (filter.estorno) subErroStatus.push('02');
    if (filter.rejeitado) {
      subErroStatus.push('00');
      subErroStatus.push('0BD');
      subErroStatus.push('02');
    }
    if (filter.pendenciaPaga) status.push(5);

    if (status.length > 0) {
      const statusRemessa = ` AND oph."statusRemessa" IN (${status.join(',')}) `;
      queryConsorcios += statusRemessa;
      queryVanzeiros += statusRemessa;
      queryEleicaoConsorcio += statusRemessa;
      queryEleicaoVanzeiro += statusRemessa;
      if(filter.erro){
        const motivoStatus = ` AND (oph."motivoStatusRemessa" NOT IN ('00','0BD')) `;
        queryConsorcios += motivoStatus;
        queryVanzeiros += motivoStatus;
        queryEleicaoConsorcio += motivoStatus;
        queryEleicaoVanzeiro += motivoStatus;
      }
    }

    if (subErroStatus.length > 0) {
      let motivoStatus =``;
      if (filter.rejeitado) {
        motivoStatus = `AND (oph."motivoStatusRemessa" NOT IN (${subErroStatus.map((s) => `'${s}'`).join(',')})) `;
      }else{
        motivoStatus = ` AND (oph."motivoStatusRemessa" IN (${subErroStatus.map((s) => `'${s}'`).join(',')}))`;
      }
      queryConsorcios += motivoStatus;
      queryVanzeiros += motivoStatus;
      queryEleicaoConsorcio += motivoStatus;
      queryEleicaoVanzeiro += motivoStatus;
    }

    const hasQuery = queryAPagarConsorcios !== `` || queryAPagarVanzeiros !== `` || queryConsorcios !== `` || queryVanzeiros !== ``
      || queryAPagarEleicaoConsorcio !== `` || queryAPagarConsorcios !== `` || queryEleicaoConsorcio !== `` || queryAPagarEleicaoVanzeiro !== ``
      || queryPendentesConsorcio !== `` || queryPendentesVanzeiro !== ``;
    if (!hasQuery) {
      return new RelatorioFinancialMovementNovoRemessaPageDto({
        data: [],
        currentPage: 0,
        nextCursor: null,
        count,
        valorTotal,
        valorPago,
        valorRejeitado,
        valorEstornado,
        valorAguardandoPagamento,
        valorAPagar,
        valorPendente,
        valorPendenciaPaga
      });
    }

    const queries: string[] = [];

    const temFiltroConsorcio = (filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios;
    const temFiltroVanzeiros = (filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros;

    // Se nenhum status foi selecionado, inclui tudo
    const incluirAPagar = filter.aPagar || filter.pendentes || (filter.erro && !filter.rejeitado && !filter.estorno);
    
    const todosStatus = (!filter.aPagar && !filter.pago && !filter.emProcessamento && !filter.pendentes && !filter.erro && !filter.rejeitado && !filter.estorno
      && !filter.pendenciaPaga );

    if (temFiltroConsorcio) {
      if (incluirAPagar) {
        if (filter.eleicao) {
          queries.push(queryAPagarEleicaoConsorcio);
        } else {
          if (filter.aPagar) queries.push(queryAPagarConsorcios);
          if (filter.pendentes || (filter.erro && !filter.rejeitado && !filter.estorno) || todosStatus) queries.push(queryPendentesConsorcio);
          if (filter.erro) queries.push(queryConsorcios);
        }
      } 
     if((filter.todosConsorcios && !filter.pendentes) || filter.pago || filter.pendenciaPaga || filter.emProcessamento ||filter.rejeitado || filter.estorno) {
        if (filter.eleicao) {
          queries.push(queryEleicaoConsorcio);
        } else {
          queries.push(queryConsorcios);
        }
      }
    }

    if (temFiltroVanzeiros) {
      if (incluirAPagar) {
        if (filter.eleicao) {
          queries.push(queryAPagarEleicaoVanzeiro);
        } else {
          if (filter.aPagar ) queries.push(queryAPagarVanzeiros);
          if (filter.pendentes || (filter.erro && !filter.rejeitado && !filter.estorno) || todosStatus) queries.push(queryPendentesVanzeiro);
          if (filter.erro)queries.push(queryVanzeiros);
        }
      }

      if((filter.todosVanzeiros && !filter.pendentes && !filter.aPagar) || filter.pago || filter.pendenciaPaga || filter.emProcessamento ||filter.rejeitado || filter.estorno) {
        if (filter.eleicao) {
          queries.push(queryEleicaoVanzeiro);
        } else {
          queries.push(queryVanzeiros);
        }
      }
    }

    if (!temFiltroVanzeiros && !temFiltroConsorcio) {
      if (filter.eleicao) {
        queries.push(queryEleicaoVanzeiro);
      }
      if (filter.todosConsorcios) {
        queries.push(queryConsorcios);
      }
      if (filter.todosVanzeiros) {
        queries.push(queryVanzeiros);
      }
    }

    // Junta só as queries que realmente existem
    const parts = queries.filter(q => q !== ``);

    this.logger.debug(`Constructed query: ${queries[0]} parts`);

    let query = ``;

    if (parts.length === 0) {
      // nada pra buscar
      return new RelatorioFinancialMovementNovoRemessaPageDto({
        data: [],
        currentPage: currentPage,
        nextCursor: null,
        pageSize: pageSize,
        count,
        valorTotal,
        valorPago,
        valorRejeitado,
        valorEstornado,
        valorAguardandoPagamento,
        valorAPagar,
        valorPendente,
        valorPendenciaPaga
      });
    } 


    const baseUnion = `SELECT * FROM (${parts.join(' UNION ALL ')}) AS R WHERE (R."nomes" is not null) `;

    let params: any[] = [];
    let paramIndex = 1;
    let whereValor = ``;

    if (filter.valorMin !== undefined && filter.valorMax !== undefined) {
      whereValor += ` AND R.valor >= $${paramIndex++} AND R.valor <= $${paramIndex++}`;
      params.push(filter.valorMin, filter.valorMax);
    } else if (filter.valorMin !== undefined) {
      whereValor += ` AND R.valor >= $${paramIndex++}`;
      params.push(filter.valorMin);
    } else if (filter.valorMax !== undefined) {
      whereValor += ` AND R.valor <= $${paramIndex++}`;
      params.push(filter.valorMax);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {

      // 1. Agregados (count + todos os SUM condicionais) numa única query, com FILTER,
      // em vez de uma query de count + até 6 queries de SUM separadas sobre o mesmo baseUnion.
      // Os SUMs valem tanto agrupado quanto não (somam as mesmas linhas de r de qualquer
      // forma); só o "total" muda, porque a paginação abaixo passa a contar grupos, não linhas.
      const totalExpression = isGroupedConsorcioSelection
        ? `COUNT(DISTINCT ("dataReferencia", consorcio, status))`
        : `COUNT(*)`;

      const aggQuery = `
        WITH r AS (${baseUnion + whereValor})
        SELECT
          ${totalExpression} AS total,
          COALESCE(SUM(valor), 0) AS "valorTotal",
          COALESCE(SUM(valor) FILTER (WHERE status = 'Pago'), 0) AS "valorPago",
          COALESCE(SUM(valor) FILTER (WHERE status = 'Rejeitado'), 0) AS "valorRejeitado",
          COALESCE(SUM(valor) FILTER (WHERE status = 'Estorno'), 0) AS "valorEstornado",
          COALESCE(SUM(valor) FILTER (WHERE status = 'Aguardando Pagamento'), 0) AS "valorAguardandoPagamento",
          COALESCE(SUM(valor) FILTER (WHERE dataPagamento IS NULL), 0) AS "valorApagarOuPendente",
          COALESCE(SUM(valor) FILTER (WHERE status = 'Pendencia Paga'), 0) AS "valorPendenciaPaga"
        FROM r`;

      this.logger.debug(`Executing aggregate query: ${aggQuery} with params: ${params.join(', ')}`);

      const [agg] = await queryRunner.query(aggQuery, params);

      count = parseInt(agg?.total ?? '0', 10);
      valorTotal = Number(agg?.valorTotal ?? 0);

      // valorAPagar e valorPendente são a mesma condição (dataPagamento IS NULL);
      // qual variável recebe o valor depende de qual filtro foi pedido.
      const valorApagarOuPendente = Number(agg?.valorApagarOuPendente ?? 0);

      if (filter.pago) valorPago = Number(agg?.valorPago ?? 0);
      if (filter.rejeitado || (filter.erro && !filter.estorno && !filter.pendentes)) valorRejeitado = Number(agg?.valorRejeitado ?? 0);
      if (filter.estorno || (filter.erro && !filter.rejeitado && !filter.pendentes)) valorEstornado = Number(agg?.valorEstornado ?? 0);
      if (filter.emProcessamento) valorAguardandoPagamento = Number(agg?.valorAguardandoPagamento ?? 0);
      if (filter.aPagar) valorAPagar = valorApagarOuPendente;
      if (filter.pendentes || (filter.erro && !filter.rejeitado && !filter.estorno)) valorPendente = valorApagarOuPendente;
      if (filter.pendenciaPaga) valorPendenciaPaga = Number(agg?.valorPendenciaPaga ?? 0);

      // 2. Query paginada — qualquer consorcio selecionado mostra uma linha por data/status
      // somando o valor de todo mundo daquele consorcio, em vez de uma linha por vanzeiro.
      const dataQuery = isGroupedConsorcioSelection
        ? `
          WITH r AS (${baseUnion + whereValor})
          SELECT
            "dataReferencia",
            consorcio AS nomes,
            NULL::text AS email,
            NULL::text AS "codBanco",
            NULL::text AS "nomeBanco",
            NULL::text AS "cpfCnpj",
            consorcio,
            SUM(valor) AS valor,
            NULL::text AS "dataPagamento",
            status,
            STRING_AGG(DISTINCT "codigoErro", ',') AS "codigoErro"
          FROM r
          GROUP BY "dataReferencia", consorcio, status
          ORDER BY "dataReferencia", consorcio ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `
        : `${baseUnion + whereValor} ORDER BY "dataReferencia","nomes" ASC LIMIT ${pageSize} OFFSET ${offset}`;

      this.logger.debug(`Executing query: ${dataQuery} with params: ${params.join(', ')}`);

      const result = await queryRunner.query(dataQuery, params);

      const mappedResults = result.map((r) => {
        const elem = new RelatorioFinancialMovementNovoRemessaData(r);
        return elem;
      });

      const totalPages = Math.ceil(count / pageSize);
      const hasNext = currentPage < totalPages;

      return new RelatorioFinancialMovementNovoRemessaPageDto({
        data: mappedResults,
        currentPage: currentPage,
        nextCursor: hasNext ? String(currentPage + 1) : null,
        pageSize: pageSize,        
        count,
        valorTotal,
        valorPago,
        valorRejeitado,
        valorEstornado,
        valorAguardandoPagamento,
        valorAPagar,
        valorPendente,
        valorPendenciaPaga

      });

    } finally {
      await queryRunner.release();
    }

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


  private resolvePagination(filter: NormalizedFilter) {
    const currentPageRaw = Number(filter.page);
    const pageSizeRaw = Number(filter.pageSize);

    const currentPage =
      Number.isInteger(currentPageRaw) && currentPageRaw > 0 ? currentPageRaw : 1;

    let pageSize =
      Number.isInteger(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 50;

    // trava de segurança
    pageSize = Math.min(pageSize, 100);

    const offset = (currentPage - 1) * pageSize;

    return {
      currentPage,
      pageSize,
      offset
    };
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

}
