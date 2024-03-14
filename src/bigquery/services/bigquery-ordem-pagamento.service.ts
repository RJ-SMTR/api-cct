import { Injectable, Logger } from '@nestjs/common';
import { nextFriday } from 'date-fns';
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
   * Get data from current payment week (from thu to wed)
   */
  public getCurrentWeekTest(): BigqueryOrdemPagamentoDTO[] {
    // Read
    const ordemPgto: BigqueryOrdemPagamentoDTO[] = [
      {
        dataOrdem: '2024-03-11',
        idOrdemPagamento: '1',
        idConsorcio: 'idConsorcio1',
        idOperadora: 'idOperadora1',
        servico: 'AB123',
        dataPagamento: null,
        consorcio: 'Consorcio1',
        operadora: 'Operadora1',
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
        valorTotalTransacaoLiquido: 1.10,
        quantidadeTotalTransacaoCaptura: null,
        valorTotalTransacaoCaptura: null,
        indicadorOrdemValida: null,
        versao: null,
        aux_favorecidoCpfCnpj: '96583185768',
      },
      {
        dataOrdem: '2024-03-11',
        idOrdemPagamento: '1',
        dataPagamento: null,
        idConsorcio: 'idConsorcio1',
        consorcio: 'Consorcio1',
        idOperadora: 'idOperadora1',
        operadora: 'Operadora1',
        servico: 'AB124',
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
        valorTotalTransacaoLiquido: 4.90,
        quantidadeTotalTransacaoCaptura: null,
        valorTotalTransacaoCaptura: null,
        indicadorOrdemValida: null,
        versao: null,
        aux_favorecidoCpfCnpj: '96583185768',
      },
      {
        dataOrdem: '2024-03-12',
        idOrdemPagamento: '2',
        idConsorcio: 'idConsorcio1',
        idOperadora: 'idOperadora1',
        servico: 'AB123',
        dataPagamento: null,
        consorcio: 'Consorcio1',
        operadora: 'Operadora1',
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
        valorTotalTransacaoLiquido: 4.91,
        quantidadeTotalTransacaoCaptura: null,
        valorTotalTransacaoCaptura: null,
        indicadorOrdemValida: null,
        versao: null,
        aux_favorecidoCpfCnpj: '96583185768',
      },
      {
        dataOrdem: '2024-03-12',
        idOrdemPagamento: '2',
        dataPagamento: null,
        idConsorcio: 'idConsorcio1',
        consorcio: 'Consorcio1',
        idOperadora: 'idOperadora1',
        operadora: 'Operadora1',
        servico: 'AB124',
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
        valorTotalTransacaoLiquido: 1.10,
        quantidadeTotalTransacaoCaptura: null,
        valorTotalTransacaoCaptura: null,
        indicadorOrdemValida: null,
        versao: null,
        aux_favorecidoCpfCnpj: '96583185768',
      },
      {
        dataOrdem: '2024-03-12',
        idOrdemPagamento: null,
        dataPagamento: null,
        idConsorcio: 'idConsorcio1',
        consorcio: 'Consorcio1',
        idOperadora: 'idOperadora1',
        operadora: 'Operadora1',
        servico: 'AB123',
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
        aux_favorecidoCpfCnpj: null,
      },
    ] as unknown as BigqueryOrdemPagamentoDTO[];
    return ordemPgto;
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
    return ordemPgto;
  }
}
