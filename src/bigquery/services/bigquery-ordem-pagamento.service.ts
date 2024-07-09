import { Injectable, Logger } from '@nestjs/common';
import { isFriday, nextFriday, subDays } from 'date-fns';
import { BigqueryOrdemPagamentoDTO } from '../dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoRepository } from '../repositories/bigquery-ordem-pagamento.repository';

@Injectable()
export class BigqueryOrdemPagamentoService {
  private logger: Logger = new Logger('BigqueryOrdemPagamentoService', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryOrdemPagamentoRepository: BigqueryOrdemPagamentoRepository,
  ) {}

  /**
   * Get data from current payment week (qui-qua). Also with older days.
   */
  public async getFromWeek(daysBefore:number): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    // let startDate;
    // let endDate;
    let days = 7;
    const today = new Date();
    // if(dataPgto == undefined){    
    const friday = isFriday(today) ? today : nextFriday(today);  
    if(daysBefore!==undefined && days){
      days = days + daysBefore;
    }

    const startDate = subDays(friday,days);
    //const endDate =  subDays(friday, 1);
    const endDate =  subDays(new Date('2024-07-05'), 1);

    // }else{
    //   startDate = dataPgto;
    //   endDate = dataPgto;
    // }
    const ordemPgto = (
      await this.bigqueryOrdemPagamentoRepository.findMany({
        startDate: startDate,
        endDate: endDate
      })
    ).map((i) => ({ ...i } as BigqueryOrdemPagamentoDTO));
    return ordemPgto;
  }
}