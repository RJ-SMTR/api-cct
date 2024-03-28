import { Injectable, Logger } from '@nestjs/common';
import { nextFriday, subDays } from 'date-fns';
import { getPaymentWeek } from 'src/utils/payment-date-utils';
import { BigqueryOrdemPagamentoDTO } from '../dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoRepository } from '../repositories/bigquery-ordem-pagamento.repository';

@Injectable()
export class BigqueryOrdemPagamentoService {
  private logger: Logger = new Logger('BigqueryOrdemPagamentoService', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryOrdemPagamentoRepository: BigqueryOrdemPagamentoRepository,
  ) { }

  /**
   * Get data from current payment week (from thu to wed). Also with older days.
   */
  public async getAllWeek(getOlderDays?: number): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    const _getOlderDays = getOlderDays || 7;
    const paymentWeek = getPaymentWeek(nextFriday(new Date()));
    const ordemPgto = (await this.bigqueryOrdemPagamentoRepository.findMany({
      endDate: paymentWeek.endDate,
      startDate: subDays(paymentWeek.startDate, _getOlderDays),
      ignoreTransacaoLiquidoZero: true,
    })).map(i => ({ ...i } as BigqueryOrdemPagamentoDTO));
    return ordemPgto;
  }

  public async getAll(): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    const ordemPgto = (await this.bigqueryOrdemPagamentoRepository.findMany({
      ignoreTransacaoLiquidoZero: true,
    }))
      .map(i => ({ ...i } as BigqueryOrdemPagamentoDTO));
    return ordemPgto;
  }
}
