import { Injectable, Logger } from '@nestjs/common';
import { nextFriday } from 'date-fns';
import { getPaymentWeek } from 'src/utils/payment-date-utils';
import { BigqueryOrdemPagamentoRepository } from '../repositories/bigquery-ordem-pagamento.repository';
import { BigqueryOrdemPagamento } from '../entities/ordem-pagamento.bigquery-entity';

@Injectable()
export class BigqueryOrdemPagamentoService {
  private logger: Logger = new Logger('BigqueryOrdemPagamentoService', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryOrdemPagamentoRepository: BigqueryOrdemPagamentoRepository,
  ) {}

  /**
   * Get data from current payment week (from thu to wed)
   */
  public async getCurrentWeek(): Promise<BigqueryOrdemPagamento[]> {
    const paymentWeek = getPaymentWeek(nextFriday(new Date()));
    return this.bigqueryOrdemPagamentoRepository.findMany({
      startDate: paymentWeek.startDate,
      endDate: paymentWeek.endDate,
    });
  }
}
