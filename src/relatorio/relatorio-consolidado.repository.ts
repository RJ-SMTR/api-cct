import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RelatorioConsolidadoDto } from './dtos/relatorio-consolidado.dto';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { CustomLogger } from 'src/utils/custom-logger';


@Injectable()
export class RelatorioConsolidadoRepository { 
  
  constructor(@InjectDataSource()
              private readonly dataSource: DataSource) {}

              private logger = new CustomLogger(RelatorioConsolidadoRepository.name, { timestamp: true });
  
  private getQueryAPagarConsorcio(dataInicio:string,dataFim:string,
    valorMin?:number,valorMax?:number,nomeConsorcio?:string[]){ 
    let query = ` select * from ( `;
    query = query + `select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado")::float valor from ( `;
    query = query + ` select distinct ita.id AS id,
                      ita."nomeConsorcio" AS consorcio,	
                      cf.nome AS favorecido,
                      cf."cpfCnpj" AS favorecido_cpfcnpj,
                      ita."valor" AS valor_agrupado `;
    query = query +`  from transacao_agrupado ta 
                      inner join item_transacao_agrupado ita  on ita."transacaoAgrupadoId"=ta."id"	
                      inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                      inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                      inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
                      where ta."statusId"<>5 and ita."id" not in(select tv."itemTransacaoAgrupadoId" from transacao_view tv)  `;

                      if(dataInicio!==undefined && dataFim!==undefined && 
                        (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio))) 
                        query = query + ` and ita."dataOrdem" between '${dataInicio}' and '${dataFim}'`;

                      if((nomeConsorcio!==undefined) && !(['Todos'].some(i=>nomeConsorcio?.includes(i))))
                        query = query +` and ita."nomeConsorcio" in('${nomeConsorcio?.join("','")}')`;   
                    
                      query = query +`  and (ap."isPago"=false  or  ap."isPago" is null) `;
                    
                      query = query +  `) as cs `; 

                      query = query + ` group by cs."consorcio"`

                      query = query + ` order by  cs."consorcio" `;

                      query = query +  `) as resul where (1=1) `; 
                          
                      if(valorMin!==undefined)
                        query = query +`  and resul."valor">=${valorMin}`;

                      if(valorMax!==undefined)
                          query = query + ` and resul."valor"<=${valorMax}`;   

    query = query + ` union All `;

    query = query +`select * from (`;
    query = query +`select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado")::float valor from (`;
    query = query +`select distinct ita.id AS id,
                      ita."nomeConsorcio" AS consorcio,	
                      cf.nome AS favorecido,
                      cf."cpfCnpj" AS favorecido_cpfcnpj,
                      da."valorLancamento" AS valor_agrupado `;
    query = query +`  from transacao_agrupado ta 
                      inner join item_transacao_agrupado ita  on ita."transacaoAgrupadoId"=ta."id"
                      inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
                      inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                      inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                      inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
                      where ta."statusId"<>5 and  ita."id" not in(select tv."itemTransacaoAgrupadoId" from transacao_view tv) `;

                  if(dataInicio!==undefined && dataFim!==undefined && 
                    (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio))) 
                    query = query + ` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`;

                  if((nomeConsorcio!==undefined) && !(['Todos'].some(i=>nomeConsorcio?.includes(i))))
                    query = query +` and ita."nomeConsorcio" in('${nomeConsorcio?.join("','")}')`;              
                  
                    query = query + ` and	ap."isPago"=false `;

                    query = query + ` and da."ocorrenciasCnab" is null `;  
                
                    query = query +  `) as cs `;  

                    query = query + ` group by cs."consorcio"`

                    query = query + ` order by  cs."consorcio" `;

                    query = query +  `) as resul where (1=1) `; 
                      
                    if(valorMin!==undefined)
                      query = query +`  and resul."valor">=${valorMin}`;

                    if(valorMax!==undefined)
                        query = query + ` and resul."valor"<=${valorMax}`;   

    this.logger.debug(query);           
    return query;             
  }  
  
  private getQueryConsorcio(dataInicio:string,dataFim:string,pago?:boolean,
    valorMin?:number,valorMax?:number,nomeConsorcio?:string[]){ 
    let query = ` select * from ( `;
    query = query +` select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado")::float valor from ( `;
    query = query +` select distinct ita.id AS id,
                    ita."nomeConsorcio" AS consorcio,	
                    cf.nome AS favorecido,
                    cf."cpfCnpj" AS favorecido_cpfcnpj,
                    da."valorLancamento" AS valor_agrupado
                    from transacao_agrupado ta 
                    inner join item_transacao_agrupado ita on ita."transacaoAgrupadoId"=ta."id"
                    inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
                    inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                    inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                    inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
                    where ta."statusId"<>5 `;

                    if(dataInicio!==undefined && dataFim!==undefined && 
                      (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio))) 
                      query = query + ` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`;

                    if((nomeConsorcio!==undefined) && !(['Todos'].some(i=>nomeConsorcio?.includes(i))))
                      query = query +` and ita."nomeConsorcio" in('${nomeConsorcio?.join("','")}')`;              
                    
                    if(pago!==undefined)
                      query = query + ` and	ap."isPago"=${pago}`;

                    if(pago ===false){
                      query = query + ` and da."ocorrenciasCnab" is not null `;
                      query = query + ` and  da."ocorrenciasCnab" not in('00','BD') `;              
                    }
             
                    query = query +  `) as cs `;           

                    query = query + ` group by cs."consorcio"`

                    query = query + ` order by  cs."consorcio" `;

                    query = query +  `) as resul where (1=1) `; 
                          
                    if(valorMin!==undefined)
                      query = query +`  and resul."valor">=${valorMin}`;

                    if(valorMax!==undefined)
                        query = query + ` and resul."valor"<=${valorMax}`;   
           
    return query;             
  }
 
  private getQueryAPagarOperadores(dataInicio:string,dataFim:string,valorMin?:number,
    valorMax?:number,favorecidoNome?:string[]){
    let query = `select * from ( `;

    query = query + ` select cs."favorecido" nomeFavorecido,sum(cs."valor_agrupado")::float  valor  from ( `;

    query  = query + ` select distinct tv.id AS id,
                    tv."nomeConsorcio" AS consorcio,
                    cf.nome AS favorecido,
                    cf."cpfCnpj" AS favorecido_cpfcnpj,
                    tv."valorTransacao" AS valor_agrupado
                    from transacao_view tv                 
                    inner join cliente_favorecido cf on cf."cpfCnpj" = tv."operadoraCpfCnpj"
                    WHERE tv."nomeConsorcio" in('STPC','STPL') 
                    and tv."valorTransacao" >0 and 
                    tv."itemTransacaoAgrupadoId" is null `;
                    
                    query = query +`  and tv."datetimeTransacao" between '${dataInicio+' 00:00:00'}' and '${dataFim+' 23:59:59'}' `;
                    
                    if(favorecidoNome!==undefined && !(['Todos'].some(i=>favorecidoNome?.includes(i))))
                      query = query +` and cf.nome in('${favorecidoNome?.join("','")}')`;

                    query = query + ` ) as cs `;   

                    query = query + ` group by cs."consorcio", cs."favorecido" `;

                    query = query + ` order by  cs."favorecido" `;

                    query = query +  `) as resul where (1=1) `; 
                    
                    if(valorMin!==undefined)
                      query = query +` and resul."valor">=${valorMin}`;

                    if(valorMax!==undefined)
                        query = query + ` and resul."valor"<=${valorMax}`;  

    this.logger.debug(query);
    return query;
  }
  
  private getQueryOperadores(dataInicio:string,dataFim:string,pago?:boolean,valorMin?:number,
    valorMax?:number,favorecidoNome?:string[]){
      let query = ` select * from ( `;
      query  = query + ` select cs."favorecido" nomeFavorecido,sum(cs."valor_agrupado")::float  valor from ( `;
      query  = query + ` select distinct ita.id AS id,
                        ita."nomeConsorcio" AS consorcio,	
                        cf.nome AS favorecido,
                        cf."cpfCnpj" AS favorecido_cpfcnpj,
                        da."valorLancamento" AS valor_agrupado
                        from transacao_agrupado ta 
                        inner join item_transacao_agrupado ita on ita."transacaoAgrupadoId"=ta."id" 
                        inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
                        inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                        inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                        inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"	  			
                        where ita."statusId"<>5 and ita."nomeConsorcio" in('STPC','STPL') `;
                        if(dataInicio!==undefined && dataFim!==undefined &&
                          (dataFim === dataInicio ||  new Date(dataFim)>new Date(dataInicio))) 
                          query = query +` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`;

                        if(pago!==undefined)
                          query = query + ` and	ap."isPago"=${pago}`;

                        if(pago ===false)
                          query = query + ` and da."ocorrenciasCnab" is not null
                          and  da."ocorrenciasCnab" not in('00','BD') `; 
                        
                        if(favorecidoNome!==undefined && !(['Todos'].some(i=>favorecidoNome?.includes(i))))
                          query = query +` and cf.nome in('${favorecidoNome?.join("','")}')`;

                        query = query +  `) as cs `;                                   

                        query = query + ` group by cs."consorcio", cs."favorecido" `;

                        query = query + ` order by  cs."favorecido" `;

                        query = query +  `) as resul where (1=1) `; 
                        
                        if(valorMin!==undefined)
                          query = query +`  and resul."valor">=${valorMin}`;

                        if(valorMax!==undefined)
                            query = query + ` and resul."valor"<=${valorMax}`;  
    return query;
  }

  public async findConsolidado(args: IFindPublicacaoRelatorio): Promise<RelatorioConsolidadoDto[]> {   
    let queryConsorcio = '';
    if(args.aPagar === true && args.favorecidoNome ===undefined){
      queryConsorcio = this.getQueryAPagarConsorcio(args.dataInicio.toISOString().slice(0,10),
      args.dataFim.toISOString().slice(0,10),args.valorMin,
        args.valorMax,args.consorcioNome);
    }  

    if((args.aPagar === undefined || args.aPagar === false) && 
    (args.consorcioNome!==undefined || args.favorecidoNome === undefined)){
      queryConsorcio = this.getQueryConsorcio(args.dataInicio.toISOString().slice(0,10),
      args.dataFim.toISOString().slice(0,10),args.pago,args.valorMin,
        args.valorMax,args.consorcioNome);
    }   
   
    let queryOperadores ='';
    if(args.aPagar === true && args.consorcioNome===undefined){
      queryOperadores = this.getQueryAPagarOperadores(args.dataInicio.toISOString().slice(0,10),
      args.dataFim.toISOString().slice(0,10),args.valorMin,
        args.valorMax,args.favorecidoNome);
    }  

    if((args.aPagar === undefined || args.aPagar === false) && (args.consorcioNome===undefined || args.favorecidoNome !==undefined)) {
      queryOperadores = this.getQueryOperadores(args.dataInicio.toISOString().slice(0,10),
      args.dataFim.toISOString().slice(0,10),args.pago,args.valorMin,args.valorMax,args.favorecidoNome); 
    }
        
    if(queryConsorcio !=='' && queryOperadores!==''){   
      queryOperadores = ` union all `+queryOperadores;      
    }   
    
    const query = queryConsorcio + queryOperadores;
    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const consolidados = result.map((r) => new RelatorioConsolidadoDto(r));
    return consolidados;
  }   
} 