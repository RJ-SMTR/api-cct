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
  
  private getQuery(dataInicio:string,dataFim:string,tipo:string,operacao:string[],conta:string){
    let query = ` SELECT distinct
                  de.id,
                  de."dataLancamento",
                  de."valorLancamento" valor,
                  case when de."tipoLancamento"='D' then 'Saída' else 'Entrada' end as tipo,
                  de."descricaoHistoricoBanco" operacao,
                  hl."valorSaldoInicial"

                  FROM public.extrato_header_arquivo ha
                  INNER JOIN public.extrato_header_lote hl ON ha.id = hl."extratoHeaderArquivoId"
                  INNER JOIN public.extrato_detalhe_e de ON de."extratoHeaderLoteId"=hl.id
                  where (1=1) `;
    const params: unknown[] = [];

    if(dataInicio!==undefined && dataFim!==undefined &&
      (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio))) {
      params.push(dataInicio+' 00:00:00', dataFim+' 00:00:00');
      query = query +` and de."dataLancamento" between $${params.length-1} and $${params.length} `;
    }

    if(tipo){
      params.push(tipo);
      query = query +` and de."tipoLancamento"=$${params.length} `;
    }

    if(operacao){
      params.push(operacao);
      query = query +` and de."descricaoHistoricoBanco" = ANY($${params.length}::text[]) `;
    }
    if(conta){
      if(conta === 'cett'){
        query = query +` and de."loteServico"='1' `;
      }else{
        query = query +` and de."loteServico"='2' `;
      }
    }

    query = query +` order by de."dataLancamento" asc `;

    return { query, params };
  }

  public async findExtrato(args: any): Promise<RelatorioExtratoBancarioDto[]> {
    const { query, params } = this.getQuery(args.dataInicio.toISOString().slice(0,10),
      args.dataFim.toISOString().slice(0,10),args.tipo,args.operacao,args.conta);

    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const result: any[] = await queryRunner.query(query, params);
    queryRunner.release();
    const extratos = result.map((r) => new RelatorioExtratoBancarioDto(r));
    return extratos;
  }
} 