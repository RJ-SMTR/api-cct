// @Exclude({ toPlainOnly: true })

import { Exclude } from 'class-transformer';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';

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
      if (this.ocorrencias.length) {
        this.ocorrencias = this.ocorrencias.map((o) => new Ocorrencia(o));
      }
    }
  }

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

  /** Valor bruto debitado na transação atual (R$) */
  transactionValue: number | null;

  /**
   * Valor a ser pago - valor líquido calculado.
   *
   * Se não houve pagamento o valor também é zero.
   */
  paidValue: number;

  /** arquivoPublicacao.isPago */
  isPago = false;

  /** arquivoPublicacao.dataEfetivacao */
  dataEfetivacao: Date;

  /** DetalheA.ocorrenciasCnab */
  @Exclude()
  ocorrenciasCnab?: string;

  /** DetalheA->Ocorrencias */
  @Exclude()
  ocorrencias: Ocorrencia[] = [];

  /**
   * Verifica se foi pago ou se não possui valor a pagar.
   *
   * Pois no sincronismo já aconteceu de termos TransacaoView gratuidade sem associação com Ordem, resultando em `isPago = false` no agrupamento e quebrando a lógica ([#475](https://github.com/RJ-SMTR/api-cct/issues/475)).
   * Por isso usamos essa lógica quando necessário.
   */
  getIsPagoOrNoValue() {
    return this.isPago || (!this.transactionValue && !this.paidValue);
  }

  /**
   * Apenas soma se status = pago
   */
  public static getAmountSum<T extends TicketRevenueDTO>(data: T[]): number {
    return +data.reduce((sum, i) => sum + (i.transactionValue || 0), 0).toFixed(2);
  }
}
