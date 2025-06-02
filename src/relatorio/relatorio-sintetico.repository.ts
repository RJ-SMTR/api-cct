import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioSinteticoDto } from './dtos/relatorio-sintetico.dto';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { getPagination } from 'src/utils/get-pagination';

@Injectable()
export class RelatorioSinteticoRepository {

  constructor(@InjectDataSource()
  private readonly dataSource: DataSource) { }

  private logger = new CustomLogger(RelatorioSinteticoRepository.name, { timestamp: true });

  public async findSintetico(args: IFindPublicacaoRelatorio,paginationOptions: PaginationOptions):
    Promise<Pagination<{data :RelatorioSinteticoDto[]}>> {
    
    const offset = (paginationOptions.page - 1) * paginationOptions.limit;

    let query = this.getQuery2024(args)+ ` union all ` + this.getQuery2025(args);

    query = query + `LIMIT ${paginationOptions.limit} OFFSET ${offset} `;

    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const sinteticos = result.map((r) => new RelatorioSinteticoDto(r));    

    let totalGeral = sinteticos.reduce((s, i) => s + Number(i.valor), 0);

    console.log(totalGeral);

    console.log(sinteticos);

    return getPagination<{ data: RelatorioSinteticoDto[],total:string}>(
      {
        data: sinteticos,
        total: totalGeral.toFixed(2) 
      },
      {
        dataLenght: sinteticos.length,
        maxCount: paginationOptions.limit,        
      },
      paginationOptions,
    );
  }

  private getQuery2024(args: IFindPublicacaoRelatorio) {
    const dataInicio = args.dataInicio.toISOString().slice(0, 10)
    const dataFim = args.dataFim.toISOString().slice(0, 10)
    let query = `SELECT DISTINCT
                    it.id,
                    it."dataOrdem",
                    da."dataVencimento" AS datapagamento,
                    it."nomeConsorcio" AS consorcio,
                    uu."fullName" AS favorecido,
                    uu."cpfCnpj",
                    it."valor",
                    case when da."ocorrenciasCnab"='00' then 'Pago'
                    when da."ocorrenciasCnab"='AL' then 'Rejeitado'
                    when da."ocorrenciasCnab"='02' then 'Estornado'
                    else 'A pagar' 
                    end as Status                   
                from item_transacao it 
                inner join item_transacao_agrupado ita on it."itemTransacaoAgrupadoId"=ita.id
                left join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                left join detalhe_a da on da."itemTransacaoAgrupadoId"=ita."id"
                left join public.user uu on uu."permitCode"=it."idOperadora"
                where (1=1)  `;

    if (dataInicio !== undefined && dataFim !== undefined &&
      (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio)))
      query = query + ` and it."dataOrdem" between '${dataInicio}' and '${dataFim}'`;

    if ((args.consorcioNome !== undefined) && !(['Todos'].some(i => args.consorcioNome?.includes(i)))) {
      query = query + ` and it."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`;
    } else if ((args.favorecidoNome !== undefined) && !(['Todos'].some(i => args.favorecidoNome?.includes(i)))){
      query = query + ` and uu."fullName" in('${args.favorecidoNome?.join("','")}'') `;
    }else if ((['Todos'].some(i => args.consorcioNome?.includes(i)))
      && (['Todos'].some(i => args.favorecidoNome?.includes(i))) ||
      ((args.consorcioNome !== undefined) && (args.favorecidoNome !== undefined))) {
      query = query + ` and it."nomeConsorcio" in ('STPC','STPL','VLT','Santa Cruz',
                         'Internorte','Intersul','Transcarioca','MobiRio','TEC') `;
    }
    else if ((['Todos'].some(i => args.favorecidoNome?.includes(i)))) {
      query = query + ` and it."nomeConsorcio" in('STPC','STPL','TEC') `;
    }

    if(args.aPagar){
      query = query +`and da."ocorrenciasCnab" is null `;
    }

    if(args.pago==true){
      query = query +`and da."ocorrenciasCnab"='00' `;
    }else if(args.pago == false){
      query = query +`and da."ocorrenciasCnab" in('AL','02') `;
    }

    if(args.valorMin && args.valorMax){
      query =  `select * from (${query}) r  where r."valor">=${args.valorMin} and r."valor"<=${args.valorMax} `;
    }else if(args.valorMin){
       query =  `select * from (${query}) r  where r."valor">=${args.valorMin} `;
    }else if(args.valorMax){
      query =  `select * from (${query}) r  where r."valor"<=${args.valorMax} `;
    }
    return query;
  }

  private getQuery2025(args: IFindPublicacaoRelatorio) {
    const dataInicio = args.dataInicio.toISOString().slice(0, 10)
    const dataFim = args.dataFim.toISOString().slice(0, 10)
    let query = `SELECT DISTINCT
                        op.id,
                        op."dataOrdem",
                        da."dataVencimento" AS datapagamento,
                        op."nomeConsorcio" AS consorcio,
                        uu."fullName" AS favorecido,
                        uu."cpfCnpj",
                        op."valor",
                      case when oph."motivoStatusRemessa"='00' then 'Pago'
                        when oph."motivoStatusRemessa"='AL' then 'Rejeitado'
                        when oph."motivoStatusRemessa"='02' then 'Estornado'
                      else 'A pagar' 
                      end as Status                    
                from ordem_pagamento op 
                inner join ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId"=opa.id
                left join ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa.id
                left join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"=oph.id
                left join public.user uu on uu."id"=op."userId"
                where (1=1)  `;

    if(dataInicio !== undefined && dataFim !== undefined &&
      (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio)))
      query = query + ` and op."dataCaptura" between '${dataInicio} 00:00:00' and '${dataFim} 23:59:59'`;
    if((args.consorcioNome !== undefined) && !(['Todos'].some(i => args.consorcioNome?.includes(i)))) {     
      query = query + ` and op."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`;
    }else if ((args.favorecidoNome !== undefined) && !(['Todos'].some(i => args.favorecidoNome?.includes(i)))){      
      query = query + ` and uu."fullName" in('${args.favorecidoNome?.join("','")}'') `;
    }else if ((['Todos'].some(i => args.consorcioNome?.includes(i)))
      && (['Todos'].some(i => args.favorecidoNome?.includes(i))) ||
      ((args.consorcioNome !== undefined) && (args.favorecidoNome !== undefined))) {
      query = query + ` and op."nomeConsorcio" in ('STPC','STPL','VLT','Santa Cruz',
                         'Internorte','Intersul','Transcarioca','MobiRio','TEC') `;
    }else if ((['Todos'].some(i => args.favorecidoNome?.includes(i)))) {
      query = query + ` and op."nomeConsorcio" in('STPC','STPL','TEC') `;
    }

    if(args.aPagar){
      query = query +` and oph."motivoStatusRemessa" is null `;
    }

    if(args.pago==true){
      query = query +` and oph."motivoStatusRemessa"='00' `;
    }else if(args.pago == false){
      query = query +` and oph."motivoStatusRemessa"in('AL','02') `;
    }

    if(args.valorMin && args.valorMax){
      query =  `select * from (${query}) r  where r."valor">=${args.valorMin} and r."valor"<=${args.valorMax} `;
    }else if(args.valorMin){
       query =  `select * from (${query}) r  where r."valor">=${args.valorMin} `;
    }else if(args.valorMax){
      query =  `select * from (${query}) r  where r."valor"<=${args.valorMax} `;
    }

    return query;
  }
} 