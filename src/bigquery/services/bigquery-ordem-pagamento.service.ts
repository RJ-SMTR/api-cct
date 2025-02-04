import { Injectable, Logger } from '@nestjs/common';
import { isFriday, nextFriday, subDays } from 'date-fns';
import { BigqueryOrdemPagamentoDTO } from '../dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoRepository } from '../repositories/bigquery-ordem-pagamento.repository';
import { CustomLogger } from 'src/utils/custom-logger';
import { IBigqueryFindOrdemPagamento } from '../interfaces/bigquery-find-ordem-pagamento.interface';

@Injectable()
export class BigqueryOrdemPagamentoService {
  private logger = new CustomLogger('BigqueryOrdemPagamentoService', { timestamp: true });

  constructor(private readonly bigqueryOrdemPagamentoRepository: BigqueryOrdemPagamentoRepository) {}

  /**
   * Get data from current payment week (qui-qua). Also with older days.
   */
  public async getFromWeek(dataCapturaInicial: Date, dataCapturaFinal: Date, daysBefore = 0, filter?: { consorcioName?: string[] }): Promise<BigqueryOrdemPagamentoDTO[]> {
    const today = new Date();
    let startDate: Date;
    let endDate: Date;

    if (dataCapturaInicial != undefined && dataCapturaFinal != undefined) {
      startDate = new Date(dataCapturaInicial);
      endDate = new Date(dataCapturaFinal);
    } else if (dataCapturaInicial != undefined && dataCapturaFinal == undefined) {
      startDate = new Date(dataCapturaInicial);
      endDate = new Date(dataCapturaInicial);
    } else {
      //Sexta a Quinta
      const friday = isFriday(today) ? today : nextFriday(today);
      startDate = subDays(friday, 7 + daysBefore);
      endDate = subDays(friday, 2);
    }
    const ordemPgto = (
      await this.bigqueryOrdemPagamentoRepository.findMany({
        startDate: startDate,
        endDate: endDate,
        ...(filter ? filter : {}),
      })
    ).map((i) => ({ ...i } as BigqueryOrdemPagamentoDTO))
    .map((ordem) => {
        if (ordem.dataCaptura) {
          ordem.dataCaptura = new Date(ordem.dataCaptura);
        }
        return ordem;
    });
    return ordemPgto;
  }
}
