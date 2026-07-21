import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/utils/custom-logger';
import { bigToNumber } from 'src/utils/pipe-utils';
import { BigqueryService, BigquerySource } from '../bigquery.service';
import { IBigqueryFindOrdemPagamentoGuardador } from '../interfaces/bigquery-find-ordem-pagamento.interface';
import { BigqueryOrdemPagamentoGuardador } from '../entities/ordem-pagamento-guardador.bigquery.entity';

@Injectable()
export class BigqueryOrdemPagamentoGuardadorRepository {
  private logger = new CustomLogger('BigqueryOrdemPagamentoGuardadorRepository', { timestamp: true });

  constructor(
    private readonly bigqueryService: BigqueryService,
  ) {}

  public async findMany(
    filter: IBigqueryFindOrdemPagamentoGuardador,
  ): Promise<BigqueryOrdemPagamentoGuardador[]> {
    const ordens: BigqueryOrdemPagamentoGuardador[] = (await this.queryData(filter)).data;
    return ordens;
  }

  public async query(
    sql: string,
  ): Promise<{ data: BigqueryOrdemPagamentoGuardador[]; countAll: number }> {    
    const queryResult = await this.bigqueryService.query(
      BigquerySource.smtr_dev,
      sql,
    );
    const count: number = queryResult.length;
    // Remove unwanted keys and remove last item (all null if empty)
    const items: BigqueryOrdemPagamentoGuardador[] = queryResult.map((i) => {
      delete i.status;
      delete i.count;
      return i;
    });

    return {
      data: items,
      countAll: count,
    };
  }

  private async queryData(
    args: IBigqueryFindOrdemPagamentoGuardador,
  ): Promise<{ data: BigqueryOrdemPagamentoGuardador[]; countAll: number }> {    
    const query = this.getQuery(args);
    const queryResult = await this.bigqueryService.query(
      BigquerySource.smtr,
      query
    );
     
    const count: number = queryResult.length;
    // Remove unwanted keys and remove last item (all null if empty)
    const items: BigqueryOrdemPagamentoGuardador[] = queryResult.map((i) => {
      delete i.status;
      delete i.count;
      i.id = bigToNumber(i.id);
      i.data_ordem = i.dataOrdem;            
      i.cpfGuardadorVeiculo = bigToNumber(i.cpfGuardadorVeiculo);
      i.quantidadeVerificacaoTotal = bigToNumber(i.quantidadeVerificacaoTotal);
      i.quantidadeVerificacaoValida = bigToNumber(i.quantidadeVerificacaoValida);
      i.quantidadeVerificacaoInvalida = bigToNumber(i.quantidadeVerificacaoInvalida);
      i.valorRepasseGuardadorVeiculo  = i.valorRepasseGuardadorVeiculo;
      i.data_inclusao = i.dataInclusao;        
      return i;
    });

    return {
      data: items,
      countAll: count,
    };
  }

  private getQuery(args: IBigqueryFindOrdemPagamentoGuardador) {
    const qArgsGuardador = this.getQueryArgs(args);    
   
    const select = ` SELECT og.id,og.data_ordem,og.id_status_ordem,og.id_ordem_pagamento_estacionamento,og.qtd_verificado,
                      og.valor_unitario_verificado,og.valor_total_verificado,og.data_pagamento,og.data_inclusao,
                      ac.documento 
                    FROM \`rj-smtr-dev.projeto_riorotativo_cct.ordem_pagamento_guardador_veiculo_dia\` og ` ;
    const query =
      select +
      `WHERE ${qArgsGuardador} ` +     
      `ORDER BY dataOrdem ASC `;
    return query;
  }
    
  private getQueryArgs(args: IBigqueryFindOrdemPagamentoGuardador) {
    const startDate = args.startDate.toISOString().slice(0, 10);
    const endDate = args.endDate.toISOString().slice(0, 10);
    let qWhere =
      ` date(og.data_ordem) BETWEEN '${startDate}' AND '${endDate}' `;
    return qWhere;
  }
}
