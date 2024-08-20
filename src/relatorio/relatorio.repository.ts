import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RelatorioConsolidadoDto } from './dtos/relatorio-consolidado.dto';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';

@Injectable()
export class RelatorioRepository {
  constructor(@InjectDataSource()
              private readonly dataSource: DataSource) {}

  private getQueryConsorcio(dataInicio?:string,dataFim?:string,pago?:boolean,
    valorMin?:number,valorMax?:number,nomeConsorcio?:string[],aPagar?:boolean){ 
    let query =
     ` select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado") valor
             from (
              select distinct ita.id AS id,
                ita."nomeConsorcio" AS consorcio,	
                cf.nome AS favorecido,
                cf."cpfCnpj" AS favorecido_cpfcnpj,
                da."valorLancamento" AS valor_agrupado
                from item_transacao_agrupado ita 
                inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
                inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
              WHERE `;

              if((nomeConsorcio!==undefined) && !(['Todos'].some(i=>nomeConsorcio?.includes(i))))
                query = query +` ita."nomeConsorcio" in('${nomeConsorcio?.join("','")}')`;
              else
                query = query +` ita."nomeConsorcio" not in('STPC','STPL') `;

              if(dataInicio!==undefined && dataFim!==undefined && 
                (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio))) 
                query = query + ` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`;
              
              if(pago!==undefined && aPagar === false)
                query = query + ` and	ap."isPago"=${pago}`;
              
              if(aPagar === true)
                query = query + ` and	ap."isPago" is null `;              
              
              if(valorMin!==undefined)
                query = query +` and da."valorLancamento">=${valorMin}`;

              if(valorMin!==undefined)
                 query = query + ` and da."valorLancamento"<=${valorMax}`;              
            
            query = query +  `) as cs
            group by cs."consorcio"`
    return query;             
  }

  private getQueryStpcStpl(dataInicio?:string,dataFim?:string,pago?:boolean,
    valorMin?:number,valorMax?:number,nomeConsorcio?:string[],aPagar?:boolean){
     let query = ` select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado") valor
              from (
                  select distinct ita.id AS id,
                    ita."nomeConsorcio" AS consorcio,	
                    cf.nome AS favorecido,
                    cf."cpfCnpj" AS favorecido_cpfcnpj,
                      da."valorLancamento" AS valor_agrupado
                          from transacao_view tv   
                          inner join item_transacao_agrupado ita on tv."itemTransacaoAgrupadoId"=ita.id
                          inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
                    inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                    inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                    inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
                  WHERE `;	
                  
                  if((nomeConsorcio!==undefined) && !(['Todos'].some(i=>nomeConsorcio?.includes(i))))
                    query = query +` ita."nomeConsorcio" in('${nomeConsorcio?.join("','")}')`;
                  else
                    query = query +` ita."nomeConsorcio" in('STPC','STPL')`;                  

                  if(dataInicio!==undefined && dataFim!==undefined &&
                    (dataFim === dataInicio ||  new Date(dataFim)>new Date(dataInicio))) 
                    query = query + ` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`;                    
                   
                  if(pago!==undefined && aPagar === false)
                    query = query + ` and	ap."isPago"=${pago}`;
                  
                  if(aPagar === true)
                    query = query + ` and	ap."isPago" is null `;   
                   
                  if(valorMin!==undefined)
                    query = query +` and da."valorLancamento">=${valorMin}`;

                  if(valorMin!==undefined)
                    query = query +` and da."valorLancamento"<=${valorMax}`;                    

                 query = query +`) as cs 
            group by cs."consorcio"`;
            return query;
  }

  private getOperadores(dataInicio?:string,dataFim?:string,pago?:boolean,valorMin?:number,
    valorMax?:number,favorecidoNome?:string[],aPagar?:boolean){
    let query = `select cs."favorecido" nomeFavorecido,sum(cs."valor_agrupado") valor
                 from (
                  select distinct ita.id AS id,
                  ita."nomeConsorcio" AS consorcio,	
                  cf.nome AS favorecido,
                  cf."cpfCnpj" AS favorecido_cpfcnpj,
                  da."valorLancamento" AS valor_agrupado
                  from transacao_view tv   
                  inner join item_transacao_agrupado ita on tv."itemTransacaoAgrupadoId"=ita.id
                  inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
                  inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                  inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                  inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"	  			
                  WHERE ita."nomeConsorcio" in('STPC','STPL') `;
                  if(dataInicio!==undefined && dataFim!==undefined &&
                    (dataFim === dataInicio ||  new Date(dataFim)>new Date(dataInicio))) 
                    query = query +` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`;

                  if(pago!==undefined && aPagar === false)
                    query = query + ` and	ap."isPago"=${pago}`;
                  
                  if(aPagar === true)
                    query = query + ` and	ap."isPago" is null `;   

                  if(valorMin!==undefined)
                    query = query +` and da."valorLancamento">=${valorMin}`;

                  if(valorMin!==undefined)
                   query = query + ` and da."valorLancamento"<=${valorMax}`;
                  
                  if(favorecidoNome!==undefined)
                    query = query +` and cf.nome in('${favorecidoNome?.join("','")}')`;
            query = query +`) as cs
            group by cs."consorcio", cs."favorecido"`;

    return query;
  }  

  public async findConsolidado(args: IFindPublicacaoRelatorio): Promise<RelatorioConsolidadoDto[]> {   
    let queryConsorcio = ''
    if(args.consorcioNome!==undefined && !(['STPC','STPL'].some(i=>args.consorcioNome?.includes(i)))){
      queryConsorcio = this.getQueryConsorcio(args.dataInicio?.toISOString().slice(0,10),
      args.dataFim?.toISOString().slice(0,10),args.pago,args.valorMin,
        args.valorMax,args.consorcioNome,args.aPagar);
    }else if(args.consorcioNome!==undefined && (['STPC','STPL'].some(i=>args.consorcioNome?.includes(i)))){
      queryConsorcio = this.getQueryStpcStpl(args.dataInicio?.toISOString().slice(0,10),
      args.dataFim?.toISOString().slice(0,10),args.pago,args.valorMin,args.valorMax,args.consorcioNome,args.aPagar);    
    }else if(args.favorecidoNome===undefined && args.consorcioNome === undefined) {
      queryConsorcio =  this.getQueryConsorcio(args.dataInicio?.toISOString().slice(0,10),
      args.dataFim?.toISOString().slice(0,10),args.pago,args.valorMin,
        args.valorMax,args.consorcioNome,args.aPagar) +
        ' union all '+
      this.getQueryStpcStpl(args.dataInicio?.toISOString().slice(0,10),
      args.dataFim?.toISOString().slice(0,10),args.pago,args.valorMin,args.valorMax);
    }

    let queryOperadores ='';

    if(args.consorcioNome==undefined){
      queryOperadores = this.getOperadores(args.dataInicio?.toISOString().slice(0,10),
      args.dataFim?.toISOString().slice(0,10),args.pago,args.valorMin,args.valorMax,args.favorecidoNome); 
    }
        
    if(queryConsorcio !=='' && queryOperadores!==''){   
      queryOperadores = ` union all `+queryOperadores;      
    }   
    
    const query = queryConsorcio + queryOperadores;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const consolidados = result.map((r) => new RelatorioConsolidadoDto(r));
    return consolidados;
  }  
} 