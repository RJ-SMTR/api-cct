import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioConsolidadoDto } from '../dtos/relatorio-consolidado.dto';
import { IFindPublicacaoRelatorio } from '../interfaces/find-publicacao-relatorio.interface';


@Injectable()
export class RelatorioGuardadorConsolidadoRepository {

  constructor(@InjectDataSource()
  private readonly dataSource: DataSource) { }

  private logger = new CustomLogger(RelatorioGuardadorConsolidadoRepository.name, { timestamp: true });

  private getQueryAPagarAssociacao(dataInicio: string, dataFim: string,
    valorMin?: number, valorMax?: number, nomeAssociacao?: string[]) {
    let query = ` select * from (`;
        query = query +` select uu."fullName" nome,round(og."valorRepasseGuardador",2) valor
                          from ordem_pagamento_guardador og
                          inner join public.user uu on uu."id"=og."userId"
                          left join ordem_pagamento_agrupado opa on opa."id"=og."ordemPagamentoAgrupadoId"
                          left join ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa."id"
                          where uu."permitCode" is null `;

    if (dataInicio !== undefined && dataFim !== undefined &&
      (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio)))
      query = query + ` and date_trunc(og."dataOrdem",day) between '${dataInicio}' and '${dataFim}' `;

    if (['Todos'].some(i => nomeAssociacao?.includes(i))) {
      query = query + ` AND og."nome" in ('ASSOCIACAO NACIONAL DOS GUARDADORES E LAVADORES DE AUTOMOVEIS CONGENERES E AFINS',
           'SINDICATO DOS GUARDADORES DE AUTOMOVEIS NO ESTADO DO RIO DE JANEIRO E REGIAO - SINGAERJ') `;
    } else if ((nomeAssociacao !== undefined) && !(['Todos'].some(i => nomeAssociacao?.includes(i))))
      query = query + ` and og."nome" in('${nomeAssociacao?.join("','")}')`;
     
    query = query + `) as r where (1=1) `;

    if (valorMin !== undefined)
      query = query + `  and r."valor">=${valorMin}`;

    if (valorMax !== undefined)
      query = query + ` and r."valor"<=${valorMax}`;
    
    return query;
  }

    private getQueryAPagarGuardadores(dataInicio: string, dataFim: string, valorMin?: number,
    valorMax?: number, favorecidoNome?: string[]) {
    let query = ` select * from (`;
        query = query +` select uu."fullName" nome,round(og."valorRepasseGuardador",2) valor
                          from ordem_pagamento_guardador og
                          inner join public.user uu on uu."id"=og."userId"
                          left join ordem_pagamento_agrupado opa on opa."id"=og."ordemPagamentoAgrupadoId"
                          left join ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa."id"
                          where uu."permitCode" is not null `;

    if (dataInicio !== undefined && dataFim !== undefined &&
      (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio)))
      query = query + ` and date_trunc(og."dataOrdem",day) between '${dataInicio}' and '${dataFim}' `;

    if (['Todos'].some(i => favorecidoNome?.includes(i))) {
      query = query + ` AND og."nome" not in ('ASSOCIACAO NACIONAL DOS GUARDADORES E LAVADORES DE AUTOMOVEIS CONGENERES E AFINS',
           'SINDICATO DOS GUARDADORES DE AUTOMOVEIS NO ESTADO DO RIO DE JANEIRO E REGIAO - SINGAERJ') `;
    } else if ((favorecidoNome !== undefined) && !(['Todos'].some(i => favorecidoNome?.includes(i))))
      query = query + ` and og."nome" in('${favorecidoNome?.join("','")}')`;
     
    query = query + `) as r where (1=1) `;

    if (valorMin !== undefined)
      query = query + `  and r."valor">=${valorMin}`;

    if (valorMax !== undefined)
      query = query + ` and r."valor"<=${valorMax}`;
    
    return query;
  }

  private getQueryAssociacao(dataInicio: string, dataFim: string, pago?: boolean,
    valorMin?: number, valorMax?: number, nomeAssociacao?: string[], emProcessamento?: boolean,rejeitado?:boolean,estornado?:boolean) {
    let query = ` select * from ( `;
    query = query +` select uu."fullName" nome,round(da."valorLancamento",2) valor
                          from ordem_pagamento_guardador og
                          inner join public.user uu on uu."id"=og."userId"
                          inner join ordem_pagamento_agrupado opa on opa."id"=og."ordemPagamentoAgrupadoId"
                          inner join ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa."id"
                          inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"=oph.id
                          where uu."permitCode" is null `;

    if(dataInicio !== undefined && dataFim !== undefined &&
      (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio)))
      query = query + ` and date_truc(da."dataVencimento",day) between '${dataInicio}' and '${dataFim}'`;

    if (['Todos'].some(i => nomeAssociacao?.includes(i))) {
      query = query + ` AND og."nome" in ('ASSOCIACAO NACIONAL DOS GUARDADORES E LAVADORES DE AUTOMOVEIS CONGENERES E AFINS',
           'SINDICATO DOS GUARDADORES DE AUTOMOVEIS NO ESTADO DO RIO DE JANEIRO E REGIAO - SINGAERJ') `;
    } else if ((nomeAssociacao !== undefined) && !(['Todos'].some(i => nomeAssociacao?.includes(i))))
      query = query + ` and og."nome" in('${nomeAssociacao?.join("','")}')`;

    if(emProcessamento == true) {
      query = query + ` and oph."statusRemessa"=2 `;
    } else if (pago !== undefined) {
      query = query + ` and	oph."statusRemessa"=3 `;
    }else if (rejeitado !== undefined || estornado!==undefined) {      
      query = query + ` and	oph."statusRemessa"=4 `;
      if(estornado){
        query = query + ` and oph."motivoStatus"='02'`;
      }else{
        query = query + ` and oph."motivoStatus"='AL'`;
      }
    }

    query = query + ` ) as r where (1=1) `;

    if (valorMin !== undefined)
      query = query + `  and r."valor">=${valorMin}`;

    if (valorMax !== undefined)
      query = query + ` and r."valor"<=${valorMax}`;

    return query;
  }

  private getQueryGuardadores(dataInicio: string, dataFim: string, pago?: boolean, valorMin?: number,
    valorMax?: number, favorecidoNome?: string[], emProcessamento?: boolean,rejeitado?:boolean,estornado?:boolean) {
     let query = ` select * from ( `;
    query = query +` select uu."fullName" nome,round(da."valorLancamento",2) valor
                          from ordem_pagamento_guardador og
                          inner join public.user uu on uu."id"=og."userId"
                          inner join ordem_pagamento_agrupado opa on opa."id"=og."ordemPagamentoAgrupadoId"
                          inner join ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa."id"
                          inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"=oph.id
                          where uu."permitCode" is null `;

    if(dataInicio !== undefined && dataFim !== undefined &&
      (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio)))
      query = query + ` and date_truc(da."dataVencimento",day) between '${dataInicio}' and '${dataFim}'`;

    if (['Todos'].some(i => favorecidoNome?.includes(i))) {
      query = query + ` AND og."nome" not in ('ASSOCIACAO NACIONAL DOS GUARDADORES E LAVADORES DE AUTOMOVEIS CONGENERES E AFINS',
           'SINDICATO DOS GUARDADORES DE AUTOMOVEIS NO ESTADO DO RIO DE JANEIRO E REGIAO - SINGAERJ') `;
    } else if ((favorecidoNome !== undefined) && !(['Todos'].some(i => favorecidoNome?.includes(i))))
      query = query + ` and og."nome" in('${favorecidoNome?.join("','")}')`;

    if(emProcessamento == true) {
      query = query + ` and oph."statusRemessa"=2 `;
    } else if (pago !== undefined) {
      query = query + ` and	oph."statusRemessa"=3 `;
    }else if (rejeitado !== undefined || estornado!==undefined) {      
      query = query + ` and	oph."statusRemessa"=4 `;
      if(estornado){
        query = query + ` and oph."motivoStatus"='02'`;
      }else{
        query = query + ` and oph."motivoStatus"='AL'`;
      }
    }

    query = query + ` ) as r where (1=1) `;

    if (valorMin !== undefined)
      query = query + `  and r."valor">=${valorMin}`;

    if (valorMax !== undefined)
      query = query + ` and r."valor"<=${valorMax}`;

    return query;
  }

  public async findConsolidado(args: IFindPublicacaoRelatorio): Promise<RelatorioConsolidadoDto[]> {
    let queryAssociacao = '';
    if (args.aPagar === true && args.favorecidoNome === undefined) {
      queryAssociacao = this.getQueryAPagarAssociacao(args.dataInicio.toISOString().slice(0, 10),
        args.dataFim.toISOString().slice(0, 10), args.valorMin,
        args.valorMax, args.consorcioNome);
    }

    if ((args.aPagar === undefined || args.aPagar === false) &&
      (args.consorcioNome !== undefined || args.favorecidoNome === undefined)) {
      queryAssociacao = this.getQueryAssociacao(args.dataInicio.toISOString().slice(0, 10),
        args.dataFim.toISOString().slice(0, 10), args.pago, args.valorMin,
        args.valorMax, args.consorcioNome, args.emProcessamento);
    }

    let queryGuardadores = '';
    if (args.aPagar === true && args.consorcioNome === undefined) {
      queryGuardadores = this.getQueryAPagarGuardadores(args.dataInicio.toISOString().slice(0, 10),
        args.dataFim.toISOString().slice(0, 10), args.valorMin,
        args.valorMax, args.favorecidoNome);
    }

    if ((args.aPagar === undefined || args.aPagar === false) && (args.consorcioNome === undefined || args.favorecidoNome !== undefined)) {
      queryGuardadores = this.getQueryGuardadores(args.dataInicio.toISOString().slice(0, 10),
        args.dataFim.toISOString().slice(0, 10), args.pago, args.valorMin, args.valorMax, args.favorecidoNome, args.emProcessamento);
    }

    if (queryAssociacao !== '' && queryGuardadores !== '') {
      queryGuardadores = ` union all ` + queryGuardadores;
    }

    const query = queryAssociacao + queryGuardadores;
    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const consolidados = result.map((r) => new RelatorioConsolidadoDto(r));
    return consolidados;
  }
} 
