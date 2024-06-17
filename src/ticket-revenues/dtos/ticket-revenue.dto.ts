// @Exclude({ toPlainOnly: true })

import { Exclude } from 'class-transformer';
import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
import { SetValueIf } from 'src/utils/decorators/set-value-if.decorator';

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
      this.isPago = Boolean(this.arquivoPublicacao?.isPago);
    }
  }

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
  transactionDateTime: string | null;

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
  captureDateTime: string | null;

  /**
   * Represents `modo`
   *
   * @description Tipo de transporte
   * @options 'BRT', 'Ônibus', 'Van', 'VLT'
   */
  transportType: string | null;

  /**
   * Represents `servico`
   *
   * @description Nome curto da linha operada pelo veículo com variação de serviço (ex: 010, 011SN, ...)
   * @example '010', '011SN'
   */
  vehicleService: string | null;

  /**
   * Represents `sentido`
   *
   * GTFS `direction_id`
   *
   * @description Sentido de operação do serviço (0 = ida, 1 = volta)
   * @example '0', '1'
   */
  directionId: number | null;

  /**
   * **Important field**
   *
   * Represents `id_veiculo`
   *
   * @description Identificador único do veículo
   */
  vehicleId: string | null;

  /**
   * Represents `id_cliente`
   *
   * @description Identificador único do cliente
   * @example '3'
   */
  clientId: string | null;

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
   * [WIP] **Dont use it!** Currently in progress by bigquery team
   *
   * Represents `id_integracao`
   *
   * @description Tipo da integração realizada (identificador relacionado à matriz de integração)
   * @type `string | null`
   */
  integrationId: string | null;

  /**
   * **Important field**
   *
   * Represents `latitude`
   *
   * @description Latitude da transação (WGS84)
   * @type `float | null`
   */
  transactionLat: number | null;

  /**
   * **Important field**
   *
   * Represents `longitude`
   *
   * @description Longitude da transação (WGS84)
   * @type `float | null`
   */
  transactionLon: number | null;

  /**
   * **Important field**
   *
   * Represents `stop_id`
   *
   * @description Código identificador do ponto de embarque (GTFS)
   * @type `float | null`
   */
  stopId: number | null;

  /**
   * **Important field**
   *
   * Represents `stop_lat`
   *
   * @description Latitude do ponto de embarque (GTFS)
   * @type `float | null`
   */
  stopLat: number | null;

  /**
   * **Important field**
   *
   * Represents `stop_lon`
   *
   * @description Longitude do ponto de embarque (GTFS)
   * @type `float | null`
   */
  stopLon: number | null;

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
  @SetValueIf((o) => o.isPago === false, 0)
  paidValue: number;

  /**
   * Represents `versao`
   *
   * @description Código de controle de versão do dado (SHA Github)
   * @example
   */
  @Exclude()
  bqDataVersion: string | null;

  isPago = false;

  @Exclude()
  arquivoPublicacao?: ArquivoPublicacao;
}
