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
    valorMin?:number,valorMax?:number,nomeConsorcio?:string[]){ 
    return `select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado") Total
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
              WHERE ita."nomeConsorcio" not in('STPC','STPL')` +
              (dataInicio!==undefined && dataFim!==undefined && dataFim>dataInicio) ? 
                ` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`:``     
              +(pago!==undefined)?` and	ap."isPago"=${pago}`:`` 
              +(valorMin!==undefined)?` and da."valorLancamento">=${valorMin}`:``
              +(valorMin!==undefined)?` and da."valorLancamento"<=${valorMax}`:``
              +(nomeConsorcio!==undefined)?` and ita."nomeConsorcio" in('${nomeConsorcio?.join("','")}')`:``
            +`) as cs
            group by cs."consorcio"`;             
  }

  private getQueryStpcStpl(dataInicio?:string,dataFim?:string,pago?:boolean,
    valorMin?:number,valorMax?:number){
     return ` select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado") Total
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
                  WHERE ita."nomeConsorcio" in('STPC','STPL')` +	
                      (dataInicio!==undefined && dataFim!==undefined && dataFim>dataInicio) ? 
                      ` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`:``     
                      +(pago!==undefined)?` and	ap."isPago"=${pago}`:`` 
                      +(valorMin!==undefined)?` and da."valorLancamento">=${valorMin}`:``
                      +(valorMin!==undefined)?` and da."valorLancamento"<=${valorMax}`:``
                 +`) as cs
            group by cs."consorcio"`;
  }

  private getOperadores(dataInicio?:string,dataFim?:string,pago?:boolean,valorMin?:number,
    valorMax?:number,favorecidoNome?:string[]){
    return `select cs."favorecido" nomeFavorecido,sum(cs."valor_agrupado") Total
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
                  WHERE ita."nomeConsorcio" in('STPC','STPL') ` +  			
                  (dataInicio!==undefined && dataFim!==undefined && dataFim>dataInicio) ? 
                  ` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`:``     
                  +(pago!==undefined)?` and	ap."isPago"=${pago}`:`` 
                  +(valorMin!==undefined)?` and da."valorLancamento">=${valorMin}`:``
                  +(valorMin!==undefined)?` and da."valorLancamento"<=${valorMax}`:``
                  +(favorecidoNome!==undefined)?` and favorecidoNome in('${favorecidoNome?.join("','")}')`:``
            +`) as cs
            group by cs."consorcio", cs."favorecido"`;
  }  

  public async findConsolidado(args: IFindPublicacaoRelatorio): Promise<RelatorioConsolidadoDto[]> {
    const query = 
      (args.consorcioNome !== undefined)? this.getQueryConsorcio(args.dataInicio?.toISOString().slice(0,10),
      args.dataFim?.toISOString().slice(0,10),args.pago,args.valorMin,
        args.valorMax,args.consorcioNome)+` union all `
        + this.getQueryStpcStpl(args.dataInicio?.toISOString().slice(0,10),
        args.dataFim?.toISOString().slice(0,10),args.pago,args.valorMin,args.valorMax)
        +` union all `:` `+
      (args.favorecidoNome!==undefined)?
        this.getOperadores(args.dataInicio?.toISOString().slice(0,10),
        args.dataFim?.toISOString().slice(0,10),args.pago,args.valorMin,args.valorMax,args.favorecidoNome):``;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const consolidados = result.map((r) => new RelatorioConsolidadoDto(r));
    return consolidados;
  }  
}