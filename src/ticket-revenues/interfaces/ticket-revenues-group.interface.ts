/**
 * This object represents a group of `IBqTicketRevenues`
 *
 * Grouped by: `partitionDate`, `permitCode`
 */
export interface ITicketRevenuesGroup {
  /**
   * Represents the total number of TicketRevenues in this group
   *
   * @example 345
   */
  count: number;

  /**
   * **Grouping primary key**
   *
   * Represents `data`
   *
   * Is recommended to use this field to filter by date in bigquery
   *
   * Partition, GMT0
   *
   * @description Data de processamento da transação (partição)
   * @type BigQueryDate | null
   * @example '2023-09-12'
   */
  partitionDate: string;

  /**
   * Represents counts of `transportType` (`modo`)
   *
   * @description Tipo de transporte (SPPO = ônibus, STPL = van, BRT)
   * @type JSON
   * @example {'SPPO': 123, 'STPL': 45}
   */
  transportTypeCounts: Record<string, number>;

  /**
   *  **Grouping primary key**
   *
   * Represents `permissao`
   *
   * @description Número da permissão do operador
   * @type string | null
   * @example 'abcde123.ab12.abcde'
   */
  permitCode: string;

  /**
   * Represents `sentido`
   *
   * GTFS `direction_id`
   *
   * @description Sentido de operação do serviço (0 = ida, 1 = volta)
   * @type JSON
   * @example = {'0': 13, '1': 32}
   */
  directionIdCounts: Record<string, number>;

  /**
   * **Important field**
   *
   * Represents `id_tipo_pagamento`
   *
   * @description Código do tipo de pagamento utilizado
   * @example {'0': 13, '1': 32}
   */
  paymentMediaTypeCounts: Record<string, number>;

  /**
   * **Important field**
   *
   * Represents `id_tipo_transacao`
   *
   * @description Tipo de transação realizada
   * @example {'0': 13, '1': 32}
   */
  transactionTypeCounts: Record<string, number>;

  /**
   * Represents counts for `transportIntegrationType` (`id_tipo_integracao`)
   *
   * @description Tipo da integração realizada (identificador relacionado à matriz de integração)
   * @example {'0': 13, '1': 32}
   */
  transportIntegrationTypeCounts: Record<string, number>;

  /**
   * **Important field**
   *
   * Represents counts for `stopId` (`stop_id`)
   *
   * @description Código identificador do ponto de embarque (GTFS)
   * @type `Record<integer, number>`
   */
  stopIdCounts: Record<number, number>;

  /**
   * **Important field**
   *
   * Represents counts for `stopLat` (`stop_lat`)
   *
   * @description Latitude do ponto de embarque (GTFS)
   * @type `Record<float, number>`
   */
  stopLatCounts: Record<number, number>;

  /**
   * **Important field**
   *
   * Represents counts for `stopLon` (`stop_lon`)
   *
   * @description Longitude do ponto de embarque (GTFS)
   * @type `Record<float, number>`
   */
  stopLonCounts: Record<number, number>;

  /**
   * **Important field**
   *
   * Represents the sum of `transactionValue` (`valor_transacao`)
   *
   * @description Valor debitado na transação atual (R$)
   * @type `float`
   */
  transactionValueSum: number;

  // Internal helper fields

  aux_epochWeek: number;

  /**
   * The first valid date or datetime string of this group.
   * @example '2023-10-01', '2023-10-02 15:01:23'
   */
  aux_groupDateTime: string;
}
