import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { Lancamento } from 'src/lancamento/entities/lancamento.entity';
import { formatDateYMD } from 'src/utils/date-utils';

export interface IOrdemPagamento {
  dataOrdem: string;
  idOrdemPagamento: string;
  idConsorcio: string;
  consorcio: string;
  idOperadora: string;
  operadora: string;
  valorTotalTransacaoLiquido: number;
  favorecidoCpfCnpj: string | null;
}

/**
 * Um DTO base para gerar itens para o Transacao, Item, ItemAgrupado, TransacaoAgrupado.
 */
export class OrdemPagamentoDto implements IOrdemPagamento {
  constructor(dto?: IOrdemPagamento) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  public static fromBigqueryOrdem(bqOrdem: BigqueryOrdemPagamentoDTO) {
    return new OrdemPagamentoDto({
      dataOrdem: bqOrdem.dataOrdem,
      idOrdemPagamento: bqOrdem.idOrdemPagamento,
      idConsorcio: bqOrdem.idConsorcio,
      consorcio: bqOrdem.consorcio,
      idOperadora: bqOrdem.idOperadora,
      operadora: bqOrdem.operadora,
      valorTotalTransacaoLiquido: bqOrdem.valorTotalTransacaoLiquido,
      favorecidoCpfCnpj: bqOrdem.consorcioCnpj || bqOrdem.operadoraCpfCnpj,
    });
  }

  public static fromLancamento(lancamento: Lancamento) {
    return new OrdemPagamentoDto({
      dataOrdem: formatDateYMD(lancamento.data_ordem),
      idOrdemPagamento: `L${new Date().getTime()}`,
      idConsorcio: '',
      consorcio: '',
      idOperadora: '',
      operadora: '',
      valorTotalTransacaoLiquido: lancamento.valor,
      favorecidoCpfCnpj: lancamento.clienteFavorecido.cpfCnpj
    });
  }

  /** BigqueryOrdem - Dia único, que representa uma ordem de pagamento */
  dataOrdem: string;

  /**
   * BiguqeryOrdem:
   * - Identificador da ordem pagamento no banco de dados da Jaé
   * - Cada **data_ordem** (dia) possui um id_ordem_pagamento único.
   *
   * Lançamento
   * - Para identificar que este ID é do Lançamento CCT, o id pode ser `L<unix_timestamp>`
   * - Exemplo: `L1725458795`
   */
  idOrdemPagamento: string;

  /** 
   * BigqueryOrdem.idConsorcio
   * 
   * Lançando: não utiliza
   */
  idConsorcio: string;

  /** 
   * BigqueryOrdem: Nome do consórcio, para referência
   * 
   * Lançamento: não utiliza
   */
  consorcio: string;

  /**
   * BigqueryOrdem: Identificador da operadora na tabela cadastro.operadoras
   *
   * Lançamento: não utiliza
   */
  idOperadora: string;

  /** BigqueryOrdem - Nome da operadora */
  operadora: string;

  /** Valor total das transações menos o valor_desconto_taxa (R$) */
  valorTotalTransacaoLiquido: number;

  /** 
   * BigqueryOrdem: consorcioCnpj ou operadoraCpfCnpj, respectivamente
   * 
   * Lançamento: clienteFavorecido.cpfCnpj
   */
  favorecidoCpfCnpj: string | null;

  /** 
   * BigqueryOrdem: não utiliza
   * 
   * Lançamento: associa com ItemTransacao
   */
  lancamento?: Lancamento;
}
