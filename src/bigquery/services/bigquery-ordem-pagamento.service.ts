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
  public async getFromWeek(dayCurrentBefore=0,daysBefore=0): Promise<BigqueryOrdemPagamentoDTO[]> {
    const today = new Date();
    let startDate;
    let endDate;

    if(dayCurrentBefore != undefined && dayCurrentBefore > 0) {//D-1 D-2 etc
      startDate = subDays(today, dayCurrentBefore);
      endDate = today;
    }else{ //Sexta a Quinta
      const friday = isFriday(today) ? today : nextFriday(today);
      startDate = subDays(friday,7 + daysBefore);
      endDate = subDays(friday,2);
    }
    const ordemPgto = (
      await this.bigqueryOrdemPagamentoRepository.findMany({
        startDate: startDate,
        endDate: endDate
      })
    ).map((i) => ({ ...i } as BigqueryOrdemPagamentoDTO));
    return ordemPgto;
  }
}