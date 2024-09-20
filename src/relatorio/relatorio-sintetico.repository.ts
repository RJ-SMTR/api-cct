import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioSinteticoDto } from './dtos/relatorio-sintetico.dto';

@Injectable()
export class RelatorioSinteticoRepository { 
  
  constructor(@InjectDataSource()
              private readonly dataSource: DataSource) {}

              private logger = new CustomLogger(RelatorioSinteticoRepository.name, { timestamp: true });
  
  private getQuery(args:IFindPublicacaoRelatorio){ 
      const dataInicio = args.dataInicio.toISOString().slice(0,10)
      const dataFim = args.dataFim.toISOString().slice(0,10)
      let query = ` select distinct res.*, `;
      query =  query + `(select sum(ss."valorLancamento")::float  from `;
      query =  query + `  (select distinct dta.id,dta."valorLancamento"                    
                            from detalhe_a dta 
                            inner join item_transacao_agrupado tt on dta."itemTransacaoAgrupadoId"=tt.id
                            left join item_transacao itt on itt."itemTransacaoAgrupadoId" = tt."id"
                            left join arquivo_publicacao app on app."itemTransacaoId"=itt.id
                            WHERE (1=1) `;
                            if(dataInicio!==undefined && dataFim!==undefined && 
                              (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio)))             
                              query = query + ` and dta."dataVencimento" between '${dataInicio}' and '${dataFim}'`;
                            if(args.emProcessamento!==undefined && args.emProcessamento===true ){
                                query = query +`  and app."isPago"=false and dta."ocorrenciasCnab" is  null `
                            }else 
                              if(args.pago !==undefined)          
                              query = query +`  and app."isPago"=${args.pago} `;

                              query = query + ` and tt."nomeConsorcio"=res.consorcio `;
                              query = query + ` )as ss)  as subTotal, `;

       query =  query + `(select sum(tt."valorLancamento")::float from
                        (select distinct dta.id,dta."valorLancamento"            
                        from detalhe_a dta 
                        inner join item_transacao_agrupado tt on dta."itemTransacaoAgrupadoId"=tt.id
                        left join item_transacao itt on itt."itemTransacaoAgrupadoId" = tt."id"
                        left join arquivo_publicacao app on app."itemTransacaoId"=itt.id
                        WHERE (1=1) `;
                        if(dataInicio!==undefined && dataFim!==undefined && 
                          (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio)))             
                          query = query + ` and dta."dataVencimento" between '${dataInicio}' and '${dataFim}'`;
                        if(args.pago !==undefined)          
                          query = query +`  and app."isPago"=${args.pago} `;

                        if((args.consorcioNome!==undefined) && !(['Todos'].some(i=>args.consorcioNome?.includes(i)))){
                          query = query +` and tt."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`; 
                        }else
                        if((args.favorecidoNome!==undefined) && !(['Todos'].some(i=>args.favorecidoNome?.includes(i))))
                          query = query +` and tt."nomeConsorcio" in(res.consorcio) `;
                        else if((['Todos'].some(i=>args.consorcioNome?.includes(i))) 
                           && (['Todos'].some(i=>args.favorecidoNome?.includes(i))) || 
                           ((args.consorcioNome!==undefined) && (args.favorecidoNome!==undefined))){
                          query = query +` and tt."nomeConsorcio" in ('STPC','STPL','VLT','Santa Cruz',
                           'Internorte','Intersul','Transcarioca','MobiRio') `;
                        }
                      else if((['Todos'].some(i=>args.favorecidoNome?.includes(i)))){
                        query = query +` and tt."nomeConsorcio" in('STPC','STPL') `;
                      }
                      query = query + ` )as tt  )as total `;
     
     query = query + `from ( `;

     if(args.aPagar === undefined || args.aPagar === false){
      query = query + `               
            select distinct
              it.id, 
              case
              when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=1 THEN --segunda
              (da."dataVencimento":: Date - INTERVAL '4 day')::varchar 
              when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=2 THEN --terça
              (da."dataVencimento":: Date -  INTERVAL '4 day')::varchar 
              when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=3 THEN --quarta
              (da."dataVencimento":: Date - INTERVAL '2 day')::varchar 
              when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=4 THEN --quinta
              (da."dataVencimento":: Date - INTERVAL '2 day')::varchar 
              when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=5 THEN --Sexta
              (da."dataVencimento":: Date - INTERVAL '2 day')::varchar 		
              end as datatransacao, 	
              da."dataVencimento"::date::Varchar As datapagamento,
              it."nomeConsorcio" AS consorcio,	
              cf.nome AS favorecido,
              it."valor"::float as valor,			      
              case when (ap."isPago") then 'pago' 
                when (not (ap."isPago")) then 'naopago'
                else 'apagar' end AS status,
              case when (not (ap."isPago")) then oc."message" else '' end As mensagem_status `; 
            
      query = query + ` from item_transacao_agrupado ita
              inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
              inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
              inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
              inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
              inner join ocorrencia oc on oc."detalheAId"=da.id              
              where (1=1)  `;
          if(dataInicio!==undefined && dataFim!==undefined && 
            (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio)))             
            query = query + ` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`;

          if((args.consorcioNome!==undefined) && !(['Todos'].some(i=>args.consorcioNome?.includes(i)))){
            query = query +` and it."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`;   
          }else
          if((args.favorecidoNome!==undefined) && !(['Todos'].some(i=>args.favorecidoNome?.includes(i)))){
            query = query +` and cf."nome" in('${args.favorecidoNome?.join("','")}')`;  
          }else
          if(
            (['Todos'].some(i=>args.consorcioNome?.includes(i))) && (['Todos'].some(i=>args.favorecidoNome?.includes(i)))
             || 
            ((args.consorcioNome!==undefined) && (args.favorecidoNome!==undefined))
           ){
           query = query +` and it."nomeConsorcio" 
             in ('STPC','STPL','VLT','Santa Cruz','Internorte','Intersul','Transcarioca','MobiRio') `;
          }else
          if((['Todos'].some(i=>args.favorecidoNome?.includes(i)))){
            query = query +` and it."nomeConsorcio" in('STPC','STPL') `;
          }

          if(args.emProcessamento!==undefined && args.emProcessamento===true){
            query = query +`  and ap."isPago"=false and da."ocorrenciasCnab" is  null `
          }else 
            if(args.pago !==undefined)          
            query = query +`  and ap."isPago"=${args.pago} `;
                  
          if(args.valorMin!==undefined)
            query = query +`  and it."valor">=${args.valorMin}`;

          if(args.valorMax!==undefined)
              query = query + ` and it."valor"<=${args.valorMax}`;           
         
          this.logger.debug(query);

          query = query +   ` union All `;
        
          query = query +` select distinct 
              it.id, 
             case
              when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=1 THEN --segunda
              (da."dataVencimento":: Date - INTERVAL '4 day')::varchar 
              when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=2 THEN --terça
              (da."dataVencimento":: Date -  INTERVAL '4 day')::varchar 
              when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=3 THEN --quarta
              (da."dataVencimento":: Date - INTERVAL '2 day')::varchar 
              when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=4 THEN --quinta
              (da."dataVencimento":: Date - INTERVAL '2 day')::varchar 
              when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=5 THEN --Sexta
              (da."dataVencimento":: Date - INTERVAL '2 day')::varchar 		
              end as datatransacao, 	
              da."dataVencimento"::date::Varchar As datapagamento,
              it."nomeConsorcio" AS consorcio,	
              cf.nome AS favorecido,
              it."valor"::float  as valor,			      
              case when (ap."isPago") then 'pago' 
                  when (not (ap."isPago")) then 'naopago'
                else 'apagar' end AS status,
              case when (not (ap."isPago")) then oc."message" else '' end As mensagem_status
              from item_transacao_agrupado ita 
              inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
              inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
              inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
              left join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
              left join ocorrencia oc on oc."detalheAId"=da.id              
              where (1=1) `;

              if(dataInicio!==undefined && dataFim!==undefined && 
                (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio)))             
                query = query + ` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`;
    
              if((args.consorcioNome!==undefined) && !(['Todos'].some(i=>args.consorcioNome?.includes(i)))){
                query = query +` and it."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`;   
              } else   
              if((args.favorecidoNome!==undefined) && !(['Todos'].some(i=>args.favorecidoNome?.includes(i)))){
                query = query +` and cf."nome" in('${args.favorecidoNome?.join("','")}')`;
              } else 
              if(
                (['Todos'].some(i=>args.consorcioNome?.includes(i))) && (['Todos'].some(i=>args.favorecidoNome?.includes(i)))
                 || 
                ((args.consorcioNome!==undefined) && (args.favorecidoNome!==undefined))
               ){
               query = query +` and it."nomeConsorcio" 
               in ('STPC','STPL','VLT','Santa Cruz','Internorte','Intersul','Transcarioca','MobiRio') `;
             }else               
              if((['Todos'].some(i=>args.favorecidoNome?.includes(i)))){
                query = query +` and it."nomeConsorcio" in('STPC','STPL') `;
              }
    
              if(args.emProcessamento!==undefined && args.emProcessamento===true ){
                query = query +`  and ap."isPago"=false and da."ocorrenciasCnab" is  null `
              }else 
              if(args.pago !==undefined)          
                query = query +`  and ap."isPago"=${args.pago} `;
                      
              if(args.valorMin!==undefined)
                query = query +`  and it."valor">=${args.valorMin}`;
    
              if(args.valorMax!==undefined)
                  query = query + ` and it."valor"<=${args.valorMax}`; 
          }
          
          if((query !==` select distinct res.* from ( `) &&(args.aPagar==true))
            query = query + ` union All `;

          if(args.aPagar==true){
            query = query +` 
            select distinct 
                tv.id, 
                (tv."datetimeTransacao":: Date)::Varchar As datatransacao,
                case 			 
                when (tv."nomeConsorcio" = 'VLT') THEN (tv."datetimeTransacao":: Date + INTERVAL '2 day')::varchar 				 
                when (tv."nomeConsorcio" <> 'VLT') and EXTRACT( DOW FROM tv."datetimeTransacao") =0 THEN 
                (tv."datetimeTransacao":: Date + INTERVAL '3 day')::varchar 
                when (tv."nomeConsorcio" <> 'VLT') and EXTRACT( DOW FROM tv."datetimeTransacao")=1 THEN 
                (tv."datetimeTransacao":: Date + INTERVAL '2 day')::varchar 
                when (tv."nomeConsorcio" <> 'VLT') and EXTRACT( DOW FROM tv."datetimeTransacao")=2 THEN
                 (tv."datetimeTransacao":: Date + INTERVAL '8 day')::varchar 
                when (tv."nomeConsorcio" <> 'VLT') and EXTRACT( DOW FROM tv."datetimeTransacao")=3 THEN 
                (tv."datetimeTransacao":: Date + INTERVAL '7 day')::varchar 
                when (tv."nomeConsorcio" <> 'VLT') and EXTRACT( DOW FROM tv."datetimeTransacao")=4 THEN 
                (tv."datetimeTransacao":: Date + INTERVAL '6 day')::varchar 
                when (tv."nomeConsorcio" <> 'VLT') and EXTRACT( DOW FROM tv."datetimeTransacao")=5 THEN 
                (tv."datetimeTransacao":: Date + INTERVAL '5 day')::varchar 
                when (tv."nomeConsorcio" <> 'VLT') and EXTRACT( DOW FROM tv."datetimeTransacao")=6 THEN 
                (tv."datetimeTransacao":: Date + INTERVAL '4 day')::varchar 
                end as datapagamento,	
                tv."nomeConsorcio" AS consorcio,	
                cf.nome AS favorecido,
                round(tv."valorPago",2)::float  as valor,			      
                'a pagar' AS status,
                '' As mensagem_status		  
             
                from transacao_view tv			  
                inner join cliente_favorecido cf on tv."operadoraCpfCnpj"=cf."cpfCnpj"
                where tv."valorPago" > 0	`; 	
              if(dataInicio!==undefined && dataFim!==undefined && 
                (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio)))             
                query = query + ` and tv."datetimeTransacao" between '${dataInicio}' and '${dataFim}'`;
    
              if((args.consorcioNome!==undefined) && !(['Todos'].some(i=>args.consorcioNome?.includes(i)))){
                query = query +` and tv."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`;   
              }else
              if((args.favorecidoNome!==undefined) && !(['Todos'].some(i=>args.favorecidoNome?.includes(i)))){
                query = query +` and cf."nome" in('${args.favorecidoNome?.join("','")}')`; 
              }else
              if(
                (['Todos'].some(i=>args.consorcioNome?.includes(i))) && (['Todos'].some(i=>args.favorecidoNome?.includes(i)))
                 || 
                ((args.consorcioNome!==undefined) && (args.favorecidoNome!==undefined))
               ){
               query = query +` and tv."nomeConsorcio" 
               in ('STPC','STPL','VLT','Santa Cruz','Internorte','Intersul','Transcarioca','MobiRio') `;
              }else

              if((['Todos'].some(i=>args.favorecidoNome?.includes(i))) && (args.consorcioNome!==undefined)){
                query = query +` and tv."nomeConsorcio" in('STPC','STPL',${args.consorcioNome?.join("','")}) `;
              }else 
                if((['Todos'].some(i=>args.favorecidoNome?.includes(i)))){
                  query = query +` and tv."nomeConsorcio" in('STPC','STPL') `;
                }
                      
              if(args.valorMin!==undefined)
                query = query +`  and tv."valorPago">=${args.valorMin}`;
    
              if(args.valorMax!==undefined)
                  query = query + ` and tv."valorPago"<=${args.valorMax}`;   
            }

            query = query + ` ) as res
            order by  res."consorcio", res."favorecido",res."datapagamento" `;             
    return query;             
  } 
  
  public async findSintetico(args: IFindPublicacaoRelatorio): Promise<RelatorioSinteticoDto[]> {
    const query = this.getQuery(args);
    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const sinteticos = result.map((r) => new RelatorioSinteticoDto(r));
    return sinteticos;
  }   
} 