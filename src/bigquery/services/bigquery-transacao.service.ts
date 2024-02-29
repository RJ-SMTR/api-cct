import { Injectable, Logger } from '@nestjs/common';
import { nextFriday } from 'date-fns';
import { getPaymentWeek } from 'src/utils/payment-date-utils';
import { BigqueryTransacao } from '../entities/transacao.bigquery-entity';
import { BigqueryTransacaoRepository } from '../repositories/bigquery-transacao.repository';

@Injectable()
export class BigqueryTransacaoService {
  private logger: Logger = new Logger('BigqueryTransacaoService', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryTransacaoRepository: BigqueryTransacaoRepository,
  ) {}

  /**
   * Get data from current payment week (from thu to wed)
   */
  public async getTransacaoOfCurrentWeek(): Promise<BigqueryTransacao[]> {
    const paymentWeek = getPaymentWeek(nextFriday(new Date()));
    return this.bigqueryTransacaoRepository.findTransacaoBy({
      startDate: paymentWeek.startDate,
      endDate: paymentWeek.endDate,
    });
  }
}
