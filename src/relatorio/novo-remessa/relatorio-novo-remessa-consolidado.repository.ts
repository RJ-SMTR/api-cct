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

  private getQueryApagarConsorcios(dataInicio: string, dataFim: string,aPagar?:boolean,pendente?:boolean): string {
    return ` ${this.headerQueryConsorciosApagar}                    
             ${this.fromQueryApagar}
             ${this.getWhereApagar(dataInicio, dataFim,aPagar,pendente)} `;
  }

  private getQueryApagarVanzeiros(dataInicio: string, dataFim: string,aPagar?:boolean,pendente?:boolean): string {
    return ` ${this.headerQueryVanzeirosAPagar}                    
             ${this.fromQueryApagar}  
             ${this.getWhereApagar(dataInicio, dataFim,aPagar,pendente)} `;
  }

  private getWhereApagar(dataInicio: string, dataFim: string,aPagar?:boolean,pendente?:boolean): string {
    const dataMinima = this.getDataMinima();
    const dataInicioDate = new Date(dataInicio);

    if(aPagar){
      if (dataMinima && (dataMinima.getTime() >= dataInicioDate.getTime())) {
        dataInicio = dataMinima.toISOString();      
      }
    }else if(pendente){
      if (dataMinima && (dataMinima.getTime() < new Date(dataFim).getTime())) {
        dataFim = dataMinima.toISOString();      
      }
    } 

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

    let queryPendentes =``;

    //filtro principal 

    //data: filter.dataInicio,filter.dataFim    
    if (filter.aPagar === undefined && filter.emProcessamento === undefined && filter.pago === undefined
      && filter.erro === undefined && filter.eleicao == undefined && filter.pendentes==undefined) {
      queryAPagarConsorcios += this.getQueryApagarConsorcios(dataInicio, dataFim,true);
      queryAPagarVanzeiros += this.getQueryApagarVanzeiros(dataInicio, dataFim,true);     
      queryPendentes += this.getQueryApagarVanzeiros(dataInicio, dataFim,undefined,true);   
      queryAPagarEleicao += this.getQueryApagarEleicao(dataInicio, dataFim);   
      queryConsorcios += this.getQueryConsorcios(dataInicio, dataFim);
      queryVanzeiros += this.getQueryVanzeiros(dataInicio, dataFim);     
      queryEleicao += this.getQueryEleicao(dataInicio, dataFim);
      
    }

    if (filter.aPagar || filter.pendentes) {
      queryAPagarConsorcios += this.getQueryApagarConsorcios(dataInicio, dataFim,true);
      queryAPagarVanzeiros += this.getQueryApagarVanzeiros(dataInicio, dataFim,true);     
      queryPendentes += this.getQueryApagarVanzeiros(dataInicio, dataFim,undefined,true);   
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
        queryPendentes += ` AND pu."id" IN('${userPlaceholders}') `;
        queryEleicao += ` AND pu."id" IN('${userPlaceholders}') `;
      } else {
        const consorcioPlaceholders = this.MODAIS.join(`','`);
        queryAPagarVanzeiros += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11`;
        queryPendentes += ` AND op."nomeConsorcio" IN('${consorcioPlaceholders}') AND length(op."operadoraCpfCnpj")<=11`;
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
      const motivoStatus = ` AND (oph."motivoStatusRemessa" IN (${subErroStatus.map((s) => `'${s}'`).join(',')}))`;
      queryConsorcios += motivoStatus;
      queryVanzeiros += motivoStatus;
      queryEleicao += motivoStatus;
    }

    const hasQuery = queryAPagarConsorcios !== `` || queryAPagarVanzeiros !== `` || queryConsorcios !== `` || queryVanzeiros !== ``
      || queryEleicao !== `` || queryAPagarEleicao !== `` || queryPendentes!=``;
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
    const incluirAPagar = filter.aPagar || filter.pendentes || !temFiltroStatus;
    const incluirOutros = (temFiltroStatus && !filter.eleicao) || (temFiltroStatus == undefined && (!filter.aPagar && !filter.pendentes));

    if (temFiltroConsorcio) {
      if (incluirAPagar) queries.push(queryAPagarConsorcios);
      if (incluirOutros) queries.push(queryConsorcios);
    }

    if (temFiltroVanzeiros) {
      if (incluirAPagar) {
        if (!filter.eleicao) {
          if(filter.pendentes){
            queries.push(queryPendentes);
          }   
          if(filter.aPagar){       
            queries.push(queryAPagarVanzeiros)
          }
        } else {
          queries.push(queryAPagarEleicao)
        }
      }

      if (incluirOutros) {
        if (!filter.eleicao) {
          queries.push(queryVanzeiros)
        }else {        
          queries.push(queryEleicao)
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

  getDataMinima(hoje = new Date())  {
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