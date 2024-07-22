import { Injectable, Logger } from '@nestjs/common';
import { isFriday, nextFriday, subDays } from 'date-fns';
import { BigqueryTransacao } from '../entities/transacao.bigquery-entity';
import { BigqueryTransacaoRepository } from '../repositories/bigquery-transacao.repository';

@Injectable()
export class BigqueryTransacaoService {
  private logger: Logger = new Logger('BigqueryOrdemPagamentoService', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryTransacaoRepository: BigqueryTransacaoRepository,
  ) {}

  /**
   * Obter dados da semana de pagamento (qui-qua).
   *
   * @param [daysBack=0] Pega a semana atual ou N dias atrás.
   */
  public async getFromWeek(dataOrdemInicial,dataOrdemFinal,daysBack = 0): Promise<BigqueryTransacao[]> {
    if(dataOrdemInicial != undefined && dataOrdemFinal !=undefined){
      startDate = subDays(new Date(dataOrdemInicial),1);
      endDate = subDays(new Date(dataOrdemFinal),1);
    }else if((dataOrdemInicial != undefined) && dataOrdemFinal == undefined){
      startDate = subDays(new Date(dataOrdemInicial),1);
      endDate = subDays(new Date(dataOrdemInicial),1);
    }else{
      const friday = isFriday(today) ? today : nextFriday(today);
      startDate = subDays(friday,8 + daysBack);
      endDate = subDays(friday,2);
   }
    const transacao = (
      await this.bigqueryTransacaoRepository.findMany({
        startDate: startDate,
        endDate: endDate,
      })
    ).map((i) => ({ ...i } as BigqueryTransacao));
    return transacao;
  }

  /**
   * Get data from current payment week (qui-qua). Also with older days.
   */
  public async getAll(): Promise<BigqueryTransacao[]> {
    // Read
    const ordemPgto = (await this.bigqueryTransacaoRepository.findMany()).map(
      (i) => ({ ...i } as BigqueryTransacao),
    );
    return ordemPgto;
  }

  /**
   * A cada 10 dias, de hoje até a dataInicio, pesquisa e chama o callback
   */
  public async getAllPaginated(
    callback: (transacoes: BigqueryTransacao[]) => void,
    cpfCnpjs: string[] = [],
  ) {
    const transacoes: BigqueryTransacao[] =
      await this.bigqueryTransacaoRepository.findMany({
        manyCpfCnpj: cpfCnpjs,
      });
    callback(transacoes);
  }
}
