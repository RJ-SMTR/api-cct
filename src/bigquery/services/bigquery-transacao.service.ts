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
   * Get data from current payment week (qui-qua). Also with older days.
   */
  public async getFromWeek(daysBack = 0): Promise<BigqueryTransacao[]> {
    // Read
    const today = new Date();
    const friday = isFriday(today) ? today : nextFriday(today);
    const ordemPgto = (
      await this.bigqueryTransacaoRepository.findMany({
        startDate: subDays(friday, 8 + daysBack), // qui (D+0)
        endDate: subDays(friday, 2 + daysBack), // qua (D+0)
      })
    ).map((i) => ({ ...i } as BigqueryTransacao));
    return ordemPgto;
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
}
