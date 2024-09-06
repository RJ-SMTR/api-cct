// @Exclude({ toPlainOnly: true })

import { Exclude } from 'class-transformer';
import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
import { ItemTransacaoAgrupado } from 'src/cnab/entity/pagamento/item-transacao-agrupado.entity';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { TransacaoView } from 'src/transacao-bq/transacao-view.entity';

/**
 * Internal representation of `IBqApiTicketRevenues`
 *
 * For any nullable fields: `null` = unavailable data.
 *
 * **Important fields** wont accept null values because frontend may need them.
 */
export class TicketRevenueDTO {
  constructor(dto?: TicketRevenueDTO) {
    if (dto) {
      Object.assign(this, dto);
      this.isPago = Boolean(this.isPago);
      // if (this.arquivoPublicacao) {
      //   this.arquivoPublicacao = new ArquivoPublicacao(this.arquivoPublicacao);
      // }
      if (this.ocorrencias.length) {
        this.ocorrencias = this.ocorrencias.map((o) => new Ocorrencia(o));
      }
    }
  }

  // public static fromTransacaoView(tv: TransacaoView) {
  //   const publicacao = tv.arquivoPublicacao;
  //   const isPago = publicacao?.isPago == true;
  //   const revenue = new TicketRevenueDTO({
  //     captureDateTime: tv.datetimeCaptura.toISOString(),
  //     date: tv.datetimeProcessamento.toISOString(),
  //     paymentMediaType: tv.tipoPagamento,
  //     processingDateTime: tv.datetimeProcessamento.toISOString(),
  //     processingHour: tv.datetimeProcessamento.getHours(),
  //     transactionDateTime: tv.datetimeTransacao.toISOString(),
  //     transactionId: tv.idTransacao,
  //     transactionType: tv.tipoTransacao,
  //     paidValue: tv.valorPago || 0,
  //     transactionValue: tv.valorTransacao,
  //     transportIntegrationType: null,
  //     transportType: null,
  //     // arquivoPublicacao: tv.arquivoPublicacao || undefined,
  //     // itemTransacaoAgrupadoId: tv.itemTransacaoAgrupadoId || undefined,
  //     isPago,
  //     count: 1,
  //     ocorrencias: [],
  //   });
  //   return revenue;
  // }

  /**
   * Para o frontend exibir o número de passagens arrecadadas - individual é sempre 1
   */
  count: number = 1;

  /**
   * Represents `data`
   *
   * Is recommended to use this field to filter by date in bigquery
   *
   * Partition, GMT0
   *
   * @description Data de processamento da transação (partição)
   * @type `BigQueryDate | null`
   * @example '2023-09-12'
   */
  date: string;

  /**
   * Represents `hora`
   *
   * @description Hora de processamento da transação
   * @type `integer | null`
   * @example 11
   */
  processingHour: number;

  /**
   * **Important field**
   *
   * Represents `datetime_transacao`
   *
   * @description Data e hora da transação em GMT-3 (formato `YYYY-MM-ddTHH:mm:ss.ssssss`)
   * @type `BigQueryDateTime | null`
   * @example '2023-09-12T14:48:52.709319'
   */
  transactionDateTime: string;

  /**
   * **Important field**
   *
   * Represents `datetime_processamento`
   *
   * @description Data e hora de processamento da transação em GMT-3 (formato `YYYY-MM-ddTHH:mm:ss.ssssss`)
   * @example '2023-09-12T14:48:52.709319'
   */
  processingDateTime: string;

  /**
   * Represents `datetime_captura`
   *
   * @description Timestamp de captura em GMT-3 (formato YYYY-MM-dd HH:mm:ssTZD)
   * @example '2023-09-12 14:49:00-03:00'
   */
  captureDateTime: string | null = null;

  /**
   * Represents `modo`
   *
   * @description Tipo de transporte
   * @options 'BRT', 'Ônibus', 'Van', 'VLT'
   */
  transportType: string | null = null;
  /**
   * **Important field**
   *
   * Repersents `id_transacao`
   *
   * @description Identificador único da transação
   * @example 123abcde-12ab-abcde12345...
   */
  transactionId: string | null;

  /**
   * **Important field**
   *
   * Represents `id_tipo_pagamento`
   *
   * @description Código do tipo de pagamento utilizado
   * @type `TicketRevenuesPaymentTypeMap`
   * @example 'NFC' = 3
   */
  paymentMediaType: string;

  /**
   * **Important field**
   *
   * Represents `tipo_transacao`
   *
   * @description Tipo de transação realizada
   * @example 'Débito', 'Recarga', 'Riocard', 'Bloqueio', 'Botoeria', 'Gratuidade', 'Cancelamento', 'Integração'
   */
  transactionType: string | null;

  /**
   * **Important field**
   *
   * Represents `id_tipo_integracao`
   *
   * @description Tipo da integração realizada (identificador relacionado à matriz de integração)
   * @type `TicketRevenuesTransportIntegrationTypeMap`
   * @example 'Transferência' = 1
   */
  transportIntegrationType: string | null;

  /**
   * Valor bruto.
   *
   * Represents `valor_transacao`
   *
   * @description Valor debitado na transação atual (R$)
   * @type `float | null`
   */
  transactionValue: number | null;

  /** Valor a ser pago - valor líquido calculado
   * Não significa que foi pago
   */
  paidValue: number;

  /** arquivoPublicacao.isPago */
  isPago = false;

  /** arquivoPublicacao.dataEfetivacao */
  dataEfetivacao: Date;

  // @Exclude()
  // arquivoPublicacao?: ArquivoPublicacao;

  // @Exclude()
  // itemTransacaoAgrupadoId?: number;

  /** DetalheA.ocorrenciasCnab */
  @Exclude()
  ocorrenciasCnab?: string;

  /** DetalheA->Ocorrencias */
  @Exclude()
  ocorrencias: Ocorrencia[] = [];

  /**
   * Apenas soma se status = pago
   */
  public static getAmountSum<T extends TicketRevenueDTO>(data: T[]): number {
    return +data.reduce((sum, i) => sum + (i.transactionValue || 0), 0).toFixed(2);
  }
}
