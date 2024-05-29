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
  public async getFromWeek(daysBefore = 0): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    const today = new Date();
    const friday = isFriday(today) ? today : nextFriday(today);

    const ordemPgto = (
      await this.bigqueryOrdemPagamentoRepository.findMany({
        startDate: subDays(friday, 7 + daysBefore), // sex
        endDate: subDays(friday, 1 + daysBefore), // qui
      })
    ).map((i) => ({ ...i } as BigqueryOrdemPagamentoDTO));
    return ordemPgto;
  }
}
