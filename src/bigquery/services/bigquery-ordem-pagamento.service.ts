import { Injectable, Logger } from '@nestjs/common';
import { nextFriday } from 'date-fns';
import { formatLog } from 'src/utils/log-utils';
import { getPaymentWeek } from 'src/utils/payment-date-utils';
import { validateDTO } from 'src/utils/validation-utils';
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
   * Get data from current payment week (from thu to wed)
   */
  public async getCurrentWeekTest(): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    const ordemPgto: BigqueryOrdemPagamentoDTO[] = [
      {
        dataOrdem: '2024-03-11',
        dataPagamento: null,
        idConsorcio: 'idConsorcio1',
        consorcio: 'Consorcio1',
        idOperadora: 'idOperadora1',
        operadora: 'Operadora1',
        servico: null,
        idOrdemPagamento: '10',
        idOrdemRessarcimento: null,
        quantidadeTransacaoDebito: null,
        valorDebito: null,
        quantidadeTransacaoEspecie: null,
        valorEspecie: null,
        quantidadeTransacaoGratuidade: null,
        valor_gratuidade: null,
        quantidadeTransacaoIntegracao: null,
        valor_integracao: null,
        quantidadeTransacaoRateioCredito: null,
        valorRateioCredito: null,
        quantidadeTransacaoRateioDebito: null,
        valorRateioDebito: null,
        quantidadeTotalTransacao: null,
        valorTotalTransacaoBruto: 10,
        valorDescontoTaxa: null,
        valorTotalTransacaoLiquido: null,
        quantidadeTotalTransacaoCaptura: null,
        valorTotalTransacaoCaptura: null,
        indicadorOrdemValida: null,
        versao: null,
        aux_favorecidoCpfCnpj: '96583185768',
      },
    ];

    return await this.validateGetCurrentWeek(ordemPgto);
  }

  /**
   * Get data from current payment week (from thu to wed)
   */
  public async getCurrentWeek(): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    const paymentWeek = getPaymentWeek(nextFriday(new Date()));
    const ordemPgto = (await this.bigqueryOrdemPagamentoRepository.findMany({
      startDate: paymentWeek.startDate,
      endDate: paymentWeek.endDate,
    })).map(i => ({ ...i } as BigqueryOrdemPagamentoDTO));

    return await this.validateGetCurrentWeek(ordemPgto);
  }

  private async validateGetCurrentWeek(dtos: BigqueryOrdemPagamentoDTO[]): Promise<BigqueryOrdemPagamentoDTO[]> {
    const METHOD = 'validateGetCurrentWeek()';
    const validDtos: BigqueryOrdemPagamentoDTO[] = [];
    for (const dto of dtos) {
      try {
        await validateDTO(BigqueryOrdemPagamentoDTO, dto);
        validDtos.push(dto);
      } catch (error) {
        this.logger.error(formatLog(`Ignoring bqOrdemPgto item: ${String(error)}`, METHOD));
      }
    }
    return validDtos;
  }
}
