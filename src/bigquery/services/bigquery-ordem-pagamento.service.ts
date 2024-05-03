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
   * Get data from current payment week (from thu to wed). Also with older days.
   */
  public async getFromWeekGrouped(): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    const today = new Date();
    const friday = isFriday(today) ? today : nextFriday(today);
    const ordemPgto = (
      await this.bigqueryOrdemPagamentoRepository.findManyGrouped({
        endDate: subDays(friday, 2),
        startDate: subDays(friday, 8),
        ignoreTransacaoLiquidoZero: true,
      })
    ).map((i) => ({ ...i } as BigqueryOrdemPagamentoDTO));
    return ordemPgto;
  }

/**
   * Get data from current payment week (from thu to wed). Also with older days.
   */
  public async getFromWeek(): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    const today = new Date();
    const friday = isFriday(today) ? today : nextFriday(today);
    const ordemPgto = (
      await this.bigqueryOrdemPagamentoRepository.findMany({
        endDate: subDays(friday, 2),
        startDate: subDays(friday, 8),
        ignoreTransacaoLiquidoZero: true,
      })
    ).map((i) => ({ ...i } as BigqueryOrdemPagamentoDTO));
    return ordemPgto;
  }

  public async getAll(): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    const ordemPgto = (
      await this.bigqueryOrdemPagamentoRepository.findMany({
        ignoreTransacaoLiquidoZero: true,
      })
    ).map((i) => ({ ...i } as BigqueryOrdemPagamentoDTO));
    return ordemPgto;
  }
}
