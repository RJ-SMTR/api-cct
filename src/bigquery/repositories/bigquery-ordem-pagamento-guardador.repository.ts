import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/utils/custom-logger';
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
      return i;
    });

    return {
      data: items,
      countAll: count,
    };
  }

  private getQuery(args: IBigqueryFindOrdemPagamentoGuardador) {
    const qArgsGuardador = this.getQueryArgs(args);    
   
    const select = ` SELECT  CAST(data_ordem AS STRING) AS dataOrdem,
                  cpf_guardador_veiculo as cpfGuardadorVeiculo,
                  quantidade_verificacao_total as quantidadeVerificacaoTotal,
                  quantidade_verificacao_valida as quantidadeVerificacaoValida,
                  quantidade_verificacao_invalida as quantidadeVerificacaoInvalida,
                  valor_repasse_guardador_veiculo as valorRepasseGuardadorVeiculo,
                  CAST(datetime_inclusao AS STRING) AS dataInclusao
                    FROM \`rj-smtr-dev.projeto_riorotativo_cct.ordem_pagamento_guardador_veiculo_dia\` og ` ;
    const query =
      select +
      `WHERE ${qArgsGuardador} ` +     
      `ORDER BY data_ordem ASC `;
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
