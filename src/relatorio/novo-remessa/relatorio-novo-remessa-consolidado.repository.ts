import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CustomLogger } from 'src/utils/custom-logger';
import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { da } from 'date-fns/locale';


@Injectable()
export class RelatorioNovoRemessaConsolidadoRepository {
  private readonly logger = new CustomLogger(RelatorioNovoRemessaConsolidadoRepository.name, { timestamp: true });

  private readonly MODAIS = ['STPC', 'STPL', 'TEC'];

  private readonly CONSORCIOS = ['VLT', 'Intersul', 'Transcarioca', 'Internorte', 'MobiRio', 'Santa Cruz', 'MOBI-Rio BUM'];

  private readonly headerQueryConsorciosApagar = ` select distinct CASE
                                                    WHEN pu."permitCode" = '8'  THEN 'VLT'
                                                      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                                      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                                      WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                                      ELSE op."nomeConsorcio"
                                                    END AS "nome" ,  
                                                    pu."fullName" AS "nome2",                 
                                                    op."valor" AS valor	`;

  private readonly headerQueryConsorcios = ` select distinct CASE
                                                WHEN pu."permitCode" = '8' OR puu."permitCode" = '8' THEN 'VLT'
                                                WHEN pu."permitCode" LIKE '4%' OR puu."permitCode" LIKE '4%' THEN 'STPC'
                                                WHEN pu."permitCode" LIKE '81%' OR puu."permitCode" LIKE '81%' THEN 'STPL'
                                                WHEN pu."permitCode" LIKE '7%' OR puu."permitCode" LIKE '7%' THEN 'TEC'
                                                ELSE COALESCE(op."nomeConsorcio", opp."nomeConsorcio")
                                              END AS "nome" ,            
                                              coalesce(pu."fullName", puu."fullName") AS "nome2",        
                                              da."valorLancamento" AS valor	`;

  private readonly headerQueryVanzeirosAPagar = ` select distinct pu."fullName" AS "nome",
                                                  op."nomeConsorcio" AS "nome2",                                                  
                                                  op."valor" AS valor	`;

  private readonly headerQueryVanzeiros = ` select distinct coalesce(pu."fullName", puu."fullName") AS "nome",
                                            CASE
                                              WHEN pu."permitCode" = '8' OR puu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' OR puu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' OR puu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' OR puu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE COALESCE(op."nomeConsorcio", opp."nomeConsorcio")
                                            END AS "nome2",                                           
                                            da."valorLancamento" AS valor	`;

  private readonly headerQueryEleicaoApagar = ` select distinct pu."fullName" AS "nome",
                                            CASE
                                              WHEN pu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE opu."consorcio" 
                                            END AS "nome2", 
                                            opu."valorTotalTransacaoLiquido" AS valor`

  private readonly headerQueryEleicao = ` select distinct pu."fullName" AS "nome",
                                            CASE
                                              WHEN pu."permitCode" = '8' THEN 'VLT'
                                              WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
                                              WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
                                              WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
                                              ELSE opu."consorcio" 
                                            END AS "nome2",                                           
                                            da."valorLancamento" AS valor	`;

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

  private readonly fromQueryEleicaoAPagar = ` from ordem_pagamento_unico opu 
                                             left join public.user pu on pu."cpfCnpj"=opu."operadoraCpfCnpj" `

  private readonly fromQueryEleicao = ` from detalhe_a da
                                        left join ordem_pagamento_agrupado_historico oph on oph."id"=da."ordemPagamentoAgrupadoHistoricoId"
                                        left join ordem_pagamento_agrupado opa on opa."id"=oph."ordemPagamentoAgrupadoId"
                                        left join ordem_pagamento_unico opu on opu."idOrdemPagamento"=opa."id"::varchar
                                        left join public.user pu on pu."cpfCnpj"=opu."operadoraCpfCnpj" `;


  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  private getQueryApagarConsorcios(dataInicio: String, dataFim: String): string {
    return ` ${this.headerQueryConsorciosApagar}                    
             ${this.fromQueryApagar}
             ${this.getWhereApagar(dataInicio, dataFim)} `;
  }

  private getQueryApagarVanzeiros(dataInicio: String, dataFim: String): string {
    return ` ${this.headerQueryVanzeirosAPagar}                    
             ${this.fromQueryApagar}  
             ${this.getWhereApagar(dataInicio, dataFim)} `;
  }

  private getWhereApagar(dataInicio: String, dataFim: String): string {
    return ` where ((op."ordemPagamentoAgrupadoId" is null) OR (da.id is null))           
             and date_trunc('day', op."dataCaptura") BETWEEN '${dataInicio}'::date AND '${dataFim}'::date `;
  }

  private getQueryApagarEleicao(dataInicio: String, dataFim: String): string {
    return ` ${this.headerQueryEleicaoApagar}                    
             ${this.fromQueryEleicaoAPagar}               
             where opu."dataOrdem" BETWEEN '${dataInicio}' AND '${dataFim}' and opu."idOrdemPagamento" is null`;
  }

  private getQueryConsorcios(dataInicio: String, dataFim: String): string {
    return `   ${this.headerQueryConsorcios}                   
               ${this.fromQueryPrincipal}
               where date_trunc('day', da."dataVencimento") BETWEEN '${dataInicio}'::date AND '${dataFim}'::date `;
  }

  private getQueryVanzeiros(dataInicio: String, dataFim: String): string {
    return `  ${this.headerQueryVanzeiros}                   
              ${this.fromQueryPrincipal}
              where date_trunc('day', da."dataVencimento") BETWEEN '${dataInicio}'::date AND '${dataFim}'::date `;
  }

  private getQueryEleicao(dataInicio: String, dataFim: String): string {
    return `  ${this.headerQueryEleicao}                   
              ${this.fromQueryEleicao}
              where date_trunc('day', da."dataVencimento") BETWEEN '${dataInicio}' AND '${dataFim}' `;
  }

  public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {

    const dataInicio = filter.dataInicio.toISOString().split('T')[0];
    const dataFim = filter.dataFim.toISOString().split('T')[0];

    let queryAPagarConsorcios = ``;

    let queryAPagarVanzeiros = ``;

    let queryConsorcios = ``;

    let queryVanzeiros = ``;

    let queryAPagarEleicao = ``;

    let queryEleicao = ``;

    //filtro principal 

    //data: filter.dataInicio,filter.dataFim    
    if (filter.aPagar === undefined && filter.emProcessamento === undefined && filter.pago === undefined
      && filter.erro === undefined && filter.eleicao == undefined) {
      queryAPagarConsorcios += this.getQueryApagarConsorcios(dataInicio, dataFim);
      queryAPagarVanzeiros += this.getQueryApagarVanzeiros(dataInicio, dataFim);
      queryConsorcios += this.getQueryConsorcios(dataInicio, dataFim);
      queryVanzeiros += this.getQueryVanzeiros(dataInicio, dataFim);
      queryAPagarEleicao += this.getQueryApagarEleicao(dataInicio, dataFim);
      queryEleicao += this.getQueryEleicao(dataInicio, dataFim);
    }

    if (filter.aPagar) {
      queryAPagarConsorcios += this.getQueryApagarConsorcios(dataInicio, dataFim);
      queryAPagarVanzeiros += this.getQueryApagarVanzeiros(dataInicio, dataFim);
      queryAPagarEleicao += this.getQueryApagarEleicao(dataInicio, dataFim);
    }

    if (filter.emProcessamento || filter.pago || filter.erro || filter.eleicao) {
      queryConsorcios += this.getQueryConsorcios(dataInicio, dataFim);
      queryVanzeiros += this.getQueryVanzeiros(dataInicio, dataFim);
      queryEleicao += this.getQueryEleicao(dataInicio, dataFim);
    }

    //Tipo de pesquisa: filter.todosVanzeiros,filter.todosConsorcios,filter.consorcioNome,filter.userIds    
    if ((filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros) {
      if (!filter.todosVanzeiros) {
        const userPlaceholders = filter.userIds?.join(`','`);
        queryAPagarVanzeiros += ` AND pu."id" IN('${userPlaceholders}') `;
        queryVanzeiros += ` AND pu."id" IN('${userPlaceholders}') `;
        queryAPagarEleicao += ` AND pu."id" IN('${userPlaceholders}') `;
        queryEleicao += ` AND pu."id" IN('${userPlaceholders}') `;
      } else {
        const consorcioPlaceholders = this.MODAIS.join(`','`);
        queryAPagarVanzeiros += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11`;
        queryVanzeiros += ` AND (op."nomeConsorcio" IN('${consorcioPlaceholders}') or opp."nomeConsorcio" IN('${consorcioPlaceholders}')) 
                            AND (length(op."operadoraCpfCnpj")<=11  or length(opp."operadoraCpfCnpj")<=11) `;
      }
    }

    if ((filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios) {
      if (!filter.todosConsorcios) {
        const consorcioPlaceholders = filter.consorcioNome?.join(`','`);
        queryAPagarConsorcios += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `;
        queryConsorcios += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `;
      } else {
        const consorcioPlaceholders = this.CONSORCIOS.join(`','`);
        queryAPagarConsorcios += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `;
        queryConsorcios += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') `;
      }
    }

    //status: filter.aPagar, filter.pago, filter.emProcessamento ,filter.erro
    //sub-fltros 
    // substatus: filter.error
    //      filter.estorno,filter.rejeitado
    // filter.pago: 
    //    filter.pendenciaPaga

    const status: number[] = [];
    const subErroStatus: string[] = [];

    if (filter.emProcessamento) status.push(2);
    if (filter.pago) status.push(3);
    if (filter.erro) status.push(4);
    if (filter.estorno) subErroStatus.push('02');
    if (filter.rejeitado) subErroStatus.push('AL');
    if (filter.pendenciaPaga) status.push(5);

    if (status.length > 0) {
      const statusRemessa = ` AND oph."statusRemessa" IN (${status.join(',')}) `;
      queryConsorcios += statusRemessa;
      queryVanzeiros += statusRemessa;
      queryEleicao += statusRemessa;
    }

    if (subErroStatus.length > 0) {
      const motivoStatus = ` AND (oph."motivoStatusRemessa" IN (${subErroStatus.map((s) => `'${s}'`).join(',')})
                              or (oph."statusRemessa"= 4 and oph."motivoStatusRemessa"<>'02') ) `;
      queryConsorcios += motivoStatus;
      queryVanzeiros += motivoStatus;
      queryEleicao += motivoStatus;
    }

    const hasQuery = queryAPagarConsorcios !== `` || queryAPagarVanzeiros !== `` || queryConsorcios !== `` || queryVanzeiros !== ``
      || queryEleicao !== `` || queryAPagarEleicao !== ``;
    if (!hasQuery) {
      return new RelatorioConsolidadoNovoRemessaDto({
        data: [],
        count: 0,
        valor: 0
      });
    }

    let params: any[] = [];
    let paramIndex = 1;

    const queries: string[] = [];

    const temFiltroConsorcio = (filter.consorcioNome && filter.consorcioNome.length > 0) || filter.todosConsorcios;
    const temFiltroVanzeiros = (filter.userIds && filter.userIds.length > 0) || filter.todosVanzeiros;
    const temFiltroStatus = filter.emProcessamento || filter.pago || filter.pendenciaPaga || filter.erro || filter.estorno || filter.rejeitado;

    // Se nenhum status foi selecionado, inclui tudo
    const incluirAPagar = filter.aPagar || !temFiltroStatus;
    const incluirOutros = (temFiltroStatus && !filter.eleicao) || (temFiltroStatus == undefined && !filter.aPagar);

    if (temFiltroConsorcio) {
      if (incluirAPagar) queries.push(queryAPagarConsorcios);
      if (incluirOutros) queries.push(queryConsorcios);
    }

    if (temFiltroVanzeiros) {
      if (incluirAPagar){
        if (!filter.eleicao) {
          queries.push(queryVanzeiros)
        } else {
          queries.push(queryEleicao)
        }
      }else if(incluirOutros){
        if (!filter.eleicao) {
          queries.push(queryVanzeiros)
        }else if(!filter.eleicao){
          queries.push(queryEleicao)          
        }
      }
    }else if(!incluirAPagar){
      queries.push(queryEleicao)        
      queries.push(queryVanzeiros)      
    }

    // Junta só as queries que realmente existem
    const parts = queries.filter(q => q !== ``);

    let query = ``;

    if (parts.length === 0) {
      // nada pra buscar
      return new RelatorioConsolidadoNovoRemessaDto({
        data: [],
        count: 0,
      });
    }

    query = `SELECT "nome", SUM("valor") AS "valor" FROM (${parts.join(' UNION ALL ')}) AS R WHERE (R."nome" is not null) `;

    // valor: filter.valorMin, filter.valorMax
    if (filter.valorMin !== undefined && filter.valorMax !== undefined) {
      query += ` AND R.valor >= $${paramIndex++} AND R.valor <= $${paramIndex++}`;
      params.push(filter.valorMin, filter.valorMax);
    } else if (filter.valorMin !== undefined) {
      query += ` AND R.valor >= $${paramIndex++}`;
      params.push(filter.valorMin);
    } else if (filter.valorMax !== undefined) {
      query += ` AND R.valor <= $${paramIndex++}`;
      params.push(filter.valorMax);
    }
    query += ` GROUP BY "nome" ORDER BY "nome" ASC `;
    this.logger.debug(`Executing query: ${query} with params: ${params.join(', ')}`, RelatorioNovoRemessaConsolidadoRepository.name);

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    const result = await queryRunner.query(query, params);

    await queryRunner.release();

    const mappedResults = result.map((r) => {
      const elem = new RelatorioConsolidadoNovoRemessaData();
      elem.nomefavorecido = r.nome;
      elem.valor = parseFloat(String(r.valor));
      return elem;
    });

    return new RelatorioConsolidadoNovoRemessaDto({
      data: mappedResults,
      count: mappedResults.length,
      valor: mappedResults.reduce((acc: any, curr: { valor: any; }) => acc + curr.valor, 0),
    });
  }
}