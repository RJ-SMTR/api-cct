import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioExtratoBancarioDto } from '../dtos/relatorio-extrato-bancario.dto';


@Injectable()
export class RelatorioExtratoBancarioRepository { 
  
  constructor(@InjectDataSource()
              private readonly dataSource: DataSource) {}

              private logger = new CustomLogger(RelatorioExtratoBancarioRepository.name, { timestamp: true });
  
  private getQuery(dataInicio:string,dataFim:string,tipo:string,operacao:string){ 
    let query = ` SELECT distinct                
                  de."dataLancamento",
                  de."valorLancamento" valor,
                  case when de."tipoLancamento"='D' then 'Debito' else 'Credito' end as tipo,
                  de."descricaoHistoricoBanco" operacao           

                  FROM public.extrato_header_arquivo ha 
                  INNER JOIN public.extrato_header_lote hl ON ha.id = hl."extratoHeaderArquivoId"
                  INNER JOIN public.extrato_detalhe_e de ON de."extratoHeaderLoteId"=hl.id 
                  where (1=1) `;

    if(dataInicio!==undefined && dataFim!==undefined && 
      (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio))) 
      query = query +` and de."dataLancamento" between '${dataInicio+' 00:00:00'}' and '${dataFim+' 23:59:59'}' `;
   
    if(tipo){
      query = query +` and de."tipoLancamento"='${tipo}' `;
    }

    if(tipo){
      query = query +` and de."descricaoHistoricoBanco"='${operacao}' `;
    }

    return query;             
  }    

  public async findExtrato(args: any): Promise<RelatorioExtratoBancarioDto[]> {   
    let query = this.getQuery(args.dataInicio.toISOString().slice(0,10),
      args.dataFim.toISOString().slice(0,10),args.tipo,args.operacao);         
    
    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const extratos = result.map((r) => new RelatorioExtratoBancarioDto(r));
    return extratos;
  }   
} 