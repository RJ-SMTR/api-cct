import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CustomLogger } from 'src/utils/custom-logger';
import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from '../dtos/relatorio-consolidado-novo-remessa.dto';


@Injectable()
export class RelatorioNovoRemessaConsolidadoRepository {
  private readonly logger = new CustomLogger(RelatorioNovoRemessaConsolidadoRepository.name, { timestamp: true });

  private readonly PENDENTES_CONSORCIOS = ['STPC', 'STPL', 'TEC'];
  private readonly TODOS_CONSORCIOS = [
    'STPC',
    'STPL',
    'VLT',
    'Santa Cruz',
    'Internorte',
    'Intersul',
    'Transcarioca',
    'MobiRio',
    'TEC',
    'MOBI-Rio BUM',
  ];

  private readonly headerQueryConsorciosApagar = ` CASE
                    WHEN pu."permitCode" = '8' OR pu."permitCode" = '8' THEN 'VLT'
                      WHEN pu."permitCode" LIKE '4%' OR pu."permitCode" LIKE '4%' THEN 'STPC'
                      WHEN pu."permitCode" LIKE '81%' OR pu."permitCode" LIKE '81%' THEN 'STPL'
                      WHEN pu."permitCode" LIKE '7%' OR pu."permitCode" LIKE '7%' THEN 'TEC'
                      ELSE COALESCE(op."nomeConsorcio", op."nomeConsorcio")
                    END AS "nome" ,
                    op."valor" AS valor	`;

  private readonly headerQueryConsorcios = ` CASE
                    WHEN pu."permitCode" = '8' OR pu."permitCode" = '8' THEN 'VLT'
                      WHEN pu."permitCode" LIKE '4%' OR pu."permitCode" LIKE '4%' THEN 'STPC'
                      WHEN pu."permitCode" LIKE '81%' OR pu."permitCode" LIKE '81%' THEN 'STPL'
                      WHEN pu."permitCode" LIKE '7%' OR pu."permitCode" LIKE '7%' THEN 'TEC'
                      ELSE COALESCE(op."nomeConsorcio", op."nomeConsorcio")
                    END AS "nome" ,
                    da."valorLancamento" AS valor	`;                  

  private readonly headerQueryVanzeirosAPagar = ` pu."fullName" AS "nome",
                                                  op."valor" AS valor	`;

  private readonly headerQueryVanzeiros = ` pu."fullName" AS "nome",
                                             da."valorLancamento" AS valor	`;


  private readonly fromQueryApagar = ` from ordem_pagamento op
              left join ordem_pagamento_agrupado opa  on op."ordemPagamentoAgrupadoId"=opa.id
              left join public.user pu on pu."id"=op."userId"	
              where op."ordemPagamentoAgrupadoId" is null `;

  private readonly fromQueryPrincipal = ` from detalhe_a da
                left join ordem_pagamento_agrupado_historico oph on oph."id"=da."ordemPagamentoAgrupadoHistoricoId"		 
                left join ordem_pagamento_agrupado opafi on opafi."id"=oph."ordemPagamentoAgrupadoId"
                left join ordem_pagamento_agrupado opai on opai."ordemPagamentoAgrupadoId"=oph."ordemPagamentoAgrupadoId"
                left join ordem_pagamento op on op."ordemPagamentoAgrupadoId"=opafi.id
                left join public.user pu on pu."id"=op."userId"
                left join ordem_pagamento opp on opp."ordemPagamentoAgrupadoId"=opai.id
                left join public.user puu on puu."id"=opp."userId" `;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  private getQueryApagarConsorcios(dataInicio: String, dataFim: String): string {
    return `select distinct ${this.headerQueryConsorciosApagar}                    
              ${this.fromQueryApagar}
              and date_trunc('day', op."dataCaptura") BETWEEN '${dataInicio}'::date AND '${dataFim}'::date `;
  }

  private getQueryApagarVanzeiros(dataInicio: String, dataFim: String): string {
    return `select distinct ${this.headerQueryVanzeirosAPagar}                    
              ${this.fromQueryApagar}              
              and date_trunc('day', op."dataCaptura") BETWEEN '${dataInicio}'::date AND '${dataFim}'::date `;
  }

  private getQueryConsorcios(dataInicio: String, dataFim: String): string {
    return `  select distinct ${this.headerQueryConsorcios}                   
                ${this.fromQueryPrincipal}
                where date_trunc('day', da."dataVencimento") BETWEEN '${dataInicio}'::date AND '${dataFim}'::date `;
  }

  private getQueryVanzeiros(dataInicio: String, dataFim: String): string {
    return `  select distinct ${this.headerQueryVanzeiros}                   
                ${this.fromQueryPrincipal}
                where date_trunc('day', da."dataVencimento") BETWEEN '${dataInicio}'::date AND '${dataFim}'::date `;
  }

  public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {

    const dataInicio = filter.dataInicio.toISOString().split('T')[0];
    const dataFim = filter.dataFim.toISOString().split('T')[0];

    let queryAPagarConsorcios = ``;

    let queryAPagarVanzeiros = ``;

    let queryConsorcios = ``;

    let queryVanzeiros = ``;

    //filtro principal 

    //data: filter.dataInicio,filter.dataFim    
    if (filter.aPagar === undefined && filter.emProcessamento === undefined && filter.pago === undefined && filter.erro === undefined) {
      queryAPagarConsorcios += this.getQueryApagarConsorcios(dataInicio, dataFim);
      queryAPagarVanzeiros += this.getQueryApagarVanzeiros(dataInicio, dataFim);
      queryConsorcios += this.getQueryConsorcios(dataInicio, dataFim);
      queryVanzeiros += this.getQueryVanzeiros(dataInicio, dataFim);
    }

    if (filter.aPagar) {
      queryAPagarConsorcios += this.getQueryApagarConsorcios(dataInicio, dataFim);
      queryAPagarVanzeiros += this.getQueryApagarVanzeiros(dataInicio, dataFim);
    }

    if (filter.emProcessamento || filter.pago || filter.erro) {
      queryConsorcios += this.getQueryConsorcios(dataInicio, dataFim);
      queryVanzeiros += this.getQueryVanzeiros(dataInicio, dataFim);
    }

    //Tipo de pesquisa: filter.todosVanzeiros,filter.todosConsorcios,filter.consorcioNome,filter.userIds    
    if (filter.userIds && filter.userIds.length > 0) {
      const userPlaceholders = filter.userIds.map(() => '?').join(', ');
      queryAPagarVanzeiros += ` AND pu."id" IN(${userPlaceholders}) `;
      queryVanzeiros += ` AND pu."id" IN(${userPlaceholders}) `;
    }

    if (filter.consorcioNome && filter.consorcioNome.length > 0) {
      const consorcioPlaceholders = filter.consorcioNome.map(() => '?').join(', ');
      queryAPagarConsorcios += ` AND op."nomeConsorcio" IN(${consorcioPlaceholders}) `;
      queryConsorcios += ` AND op."nomeConsorcio" IN(${consorcioPlaceholders}) `;
    }

    //status: filter.aPagar, filter.pago, filter.emProcessamento ,filter.erro
    //sub-fltros 
    // substatus: filter.error
    //      filter.estorno,filter.rejeitado
    // filter.pago: 
    //    filter.pendenciaPaga

    if (filter.pago || filter.emProcessamento || filter.erro) {
      const status: number[] = [];
      if (filter.emProcessamento) status.push(2);
      if (filter.pago) {
        if (filter.pendenciaPaga) {
          status.push(5);
          queryConsorcios += ` AND opa."ordemPagamentoAgrupadoId" IS NOT NULL `;
          queryVanzeiros += ` AND opa."ordemPagamentoAgrupadoId" IS NOT NULL `;
        }
        status.push(3);
      }
      if (filter.erro) {
        const subErroStatus: string[] = [];
        if (filter.estorno) subErroStatus.push('02');
        if (filter.rejeitado) subErroStatus.push('AL');
        status.push(4);
        if (subErroStatus.length > 0) {
          queryConsorcios += ` AND oph."motivoStatus" IN (${subErroStatus.map((s) => `'${s}'`).join(', ')}) `;
          queryVanzeiros += ` AND oph."motivoStatus" IN (${subErroStatus.map((s) => `'${s}'`).join(', ')}) `;
        }
        if (status.length > 0) {
          queryConsorcios += ` AND oph."statusRemessa" IN (${status.join(', ')}) `;
          queryVanzeiros += ` AND oph."statusRemessa" IN (${status.join(', ')}) `;
        }
      }
    }

    const hasQuery = queryAPagarConsorcios !== `` || queryAPagarVanzeiros !== `` || queryConsorcios !== `` || queryVanzeiros !== ``;
    if (!hasQuery) {
      return new RelatorioConsolidadoNovoRemessaDto({
        data: [],
        count: 0,
      });
    }   
    
    let params: any[] = [];
    let paramIndex = 1;

    // Junta só as queries que realmente existem
    const parts = [
      queryAPagarConsorcios,
      queryAPagarVanzeiros,
      queryConsorcios,
      queryVanzeiros
    ].filter(q => q !== ``);

    let query = ``;

    if (parts.length === 0) {
      // nada pra buscar
      return new RelatorioConsolidadoNovoRemessaDto({
        data: [],
        count: 0,
      });
    }

    query = `SELECT * FROM (${parts.join(' UNION ALL ')}) AS R WHERE 1=1`;

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

    this.logger.debug(`Executing query: ${query} with params: ${params.join(', ')}`, RelatorioNovoRemessaConsolidadoRepository.name);

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    const result = await queryRunner.query(query, params);

    await queryRunner.release();

    const mappedResults = result.map((r) => {
      const elem = new RelatorioConsolidadoNovoRemessaData();

      elem.nomefavorecido = r.nome;
      elem.cpfCnpj = r.cpfCnpj ?? null;
      elem.valor = parseFloat(String(r.valor));
      return elem;
    });

    return new RelatorioConsolidadoNovoRemessaDto({
      data: mappedResults,
      count: mappedResults.length,
    });
  }
}