import { Injectable, Logger } from '@nestjs/common';
import { endOfDay, nextFriday, startOfDay, subDays } from 'date-fns';
import { getPaymentWeek } from 'src/utils/payment-date-utils';
import { BigqueryOrdemPagamentoDTO } from '../dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoRepository } from '../repositories/bigquery-ordem-pagamento.repository';
import { PermissionarioRoleEnum } from 'src/permissionario-role/permissionario-role.enum';

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
  public async getVanzeiroWeekTest(): Promise<BigqueryOrdemPagamentoDTO[]> {
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
        valorGratuidade: null,
        quantidadeTransacaoIntegracao: null,
        valorIntegracao: null,
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
        versao: '1',
        favorecidoCpfCnpj: '96583185768',
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
        valorGratuidade: null,
        quantidadeTransacaoIntegracao: null,
        valorIntegracao: null,
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
        versao: '1',
        favorecidoCpfCnpj: '96583185768',
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
        valorGratuidade: null,
        quantidadeTransacaoIntegracao: null,
        valorIntegracao: null,
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
        versao: '1',
        favorecidoCpfCnpj: '96583185768',
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
        valorGratuidade: null,
        quantidadeTransacaoIntegracao: null,
        valorIntegracao: null,
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
        versao: '1',
        consorcioCpfCnpj: '1',
        operadoraCpfCnpj: '2',
        favorecidoCpfCnpj: '96583185768',
        uniqueId: '5',
      },
      // Invalid item
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
        valorGratuidade: null,
        quantidadeTransacaoIntegracao: null,
        valorIntegracao: null,
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
        versao: '1',
        favorecidoCpfCnpj: null,
        consorcioCpfCnpj: '1',
        operadoraCpfCnpj: '2',
        uniqueId: '5',
      },
    ] as unknown as BigqueryOrdemPagamentoDTO[];
    await new Promise(resolve => setTimeout(resolve, 1));
    return ordemPgto;
  }

  /**
   * Get data from current payment week (from thu to wed)
   */
  public async getOthersDayTest(): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    const ordemPgto: BigqueryOrdemPagamentoDTO[] = [
      {
        dataOrdem: '2024-03-11',
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
        valorGratuidade: null,
        quantidadeTransacaoIntegracao: null,
        valorIntegracao: null,
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
        versao: '1',
        favorecidoCpfCnpj: '96583185768',
        consorcioCpfCnpj: '1',
        operadoraCpfCnpj: '2',
      } as BigqueryOrdemPagamentoDTO,
      {
        dataOrdem: '2024-03-10',
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
        valorGratuidade: null,
        quantidadeTransacaoIntegracao: null,
        valorIntegracao: null,
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
        versao: '1',
        favorecidoCpfCnpj: '96583185768',
        consorcioCpfCnpj: '1',
        operadoraCpfCnpj: '2',
      } as BigqueryOrdemPagamentoDTO,
      // Invalid item
      {
        dataOrdem: '2024-03-11',
        idOrdemPagamento: null,
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
        valorGratuidade: null,
        quantidadeTransacaoIntegracao: null,
        valorIntegracao: null,
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
        versao: '1',
        favorecidoCpfCnpj: '96583185768',
        consorcioCpfCnpj: '1',
        operadoraCpfCnpj: '2',
      },
    ] as unknown as BigqueryOrdemPagamentoDTO[];
    await new Promise(resolve => setTimeout(resolve, 1));
    return ordemPgto;
  }

  /**
   * Get data from current payment week (from thu to wed). Also with older days.
   */
  public async getVanzeiroWeek(getOlderDays?: number): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    const _getOlderDays = getOlderDays || 7;
    const paymentWeek = getPaymentWeek(nextFriday(new Date()));
    const ordemPgto = (await this.bigqueryOrdemPagamentoRepository.findMany({
      endDate: paymentWeek.endDate,
      startDate: subDays(paymentWeek.startDate, _getOlderDays),
      permissionarioRole: PermissionarioRoleEnum.vanzeiro,
      ignoreTransacaoLiquidoZero: true,
    })).map(i => ({ ...i } as BigqueryOrdemPagamentoDTO));
    return ordemPgto;
  }

  /**
   * Get data from current day for non Vanzeiro permissionarios. Also with older days.
   */
  public async getOthersDay(getOlderDays?: number): Promise<BigqueryOrdemPagamentoDTO[]> {
    // Read
    const _getOlderDays = getOlderDays || 1;
    const today = new Date();
    const ordemPgto = (await this.bigqueryOrdemPagamentoRepository.findMany({
      endDate: endOfDay(today),
      startDate: subDays(startOfDay(today), _getOlderDays),
      permissionarioRole: null,
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
