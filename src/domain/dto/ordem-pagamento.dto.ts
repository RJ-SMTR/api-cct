import { nextFriday, startOfDay } from 'date-fns';
import { BigqueryOrdemPagamentoDTO } from 'src/client/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { Lancamento } from 'src/domain/entity/lancamento.entity';
import { formatDateISODate, yearMonthDayToDate } from 'src/utils/date-utils';

export interface IOrdemPagamento {
  dataOrdem: string;
  idOrdemPagamento: string;
  idConsorcio: string;
  consorcio: string;
  idOperadora: string;
  operadora: string;
  valorTotalTransacaoLiquido: number;
  favorecidoCpfCnpj: string | null;
  lancamento?: Lancamento;
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

  public static fromLancamento(lancamento: Lancamento, idOrdemPagamento?: string) {
    return new OrdemPagamentoDto({
      dataOrdem: formatDateISODate(lancamento.data_ordem),
      idOrdemPagamento: idOrdemPagamento || OrdemPagamentoDto.getIdOrdemPagamentoLancamento(),
      idConsorcio: '',
      consorcio: '',
      idOperadora: '',
      operadora: '',
      valorTotalTransacaoLiquido: lancamento.valor,
      favorecidoCpfCnpj: lancamento.clienteFavorecido.cpfCnpj,
      lancamento,
    });
  }

  /**
   * Bigquery
   * - dataOrdem: sexta de pagamento
   *
   * Lançamento
   * - dataOrdem: dia de hoje
   */
  getTransacaoAgrupadoDataOrdem() {
    return this.lancamento ? startOfDay(new Date()) : nextFriday(startOfDay(yearMonthDayToDate(this.dataOrdem)));
  }

  /** Regra de negócio: O formato do id se refere ao dia, assim como ocorre no Jaé */
  public static getIdOrdemPagamentoLancamento() {
    return `L${startOfDay(new Date()).getTime()}`;
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
   * Lançamento:
   * - Associa com ItemTransacao.
   * - Usado para verificar se esta Ordem é do Lançamento.
   */
  lancamento?: Lancamento;
}
