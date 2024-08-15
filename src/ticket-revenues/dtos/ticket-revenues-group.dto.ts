import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
import { DeepPartial } from 'typeorm';
import { ITRCounts } from '../interfaces/tr-counts.interface';
import { SetValueIf } from 'src/utils/decorators/set-value-if.decorator';

/**
 * This object represents a group of `IBqTicketRevenues`
 *
 * Grouped by: `partitionDate`, `permitCode`
 */
export class TicketRevenuesGroupDto {
  constructor(data?: DeepPartial<TicketRevenuesGroupDto>) {
    if (data) {
      Object.assign(this, data);
    }
  }

  /**
   * Represents the total number of TicketRevenues in this group
   *
   * @example 345
   */
  count = 0;

  /**
   * @example '2023-09-12'
   */
  date = '';

  /**
   * Represents counts of `transportType` (`modo`)
   *
   * @description Tipo de transporte
   * @type JSON
   * @example {
   *    'Ônibus': {
   *        'count': 12,
   *        'transactionValue': 4.9
   *    },
   *    'VLT': {
   *        'count': 45,
   *        'transactionValue': 4.9
   *    }
   * }
   */
  transportTypeCounts: Record<string, ITRCounts> = {};

  /**
   * Represents `sentido`
   *
   * GTFS `direction_id`
   *
   * @description Sentido de operação do serviço (0 = ida, 1 = volta)
   * @type JSON
   * @example = {'0': 13, '1': 32}
   */
  directionIdCounts: Record<string, ITRCounts> = {};

  /**
   * **Important field**
   *
   * Represents `id_tipo_pagamento`
   *
   * @description Código do tipo de pagamento utilizado
   * @example {'0': 13, '1': 32}
   */
  paymentMediaTypeCounts: Record<string, ITRCounts> = {};

  /**
   * **Important field**
   *
   * Represents `id_tipo_transacao`
   *
   * @description Tipo de transação realizada
   * @example {'0': 13, '1': 32}
   */
  transactionTypeCounts: Record<string, ITRCounts> = {};

  /**
   * Represents counts for `transportIntegrationType` (`id_tipo_integracao`)
   *
   * @description Tipo da integração realizada (identificador relacionado à matriz de integração)
   * @example {'0': 13, '1': 32}
   */
  transportIntegrationTypeCounts: Record<string, ITRCounts> = {};

  /**
   * **Important field**
   *
   * Represents counts for `stopId` (`stop_id`)
   *
   * @description Código identificador do ponto de embarque (GTFS)
   * @type `Record<integer, number>`
   */
  stopIdCounts: Record<number, ITRCounts> = {};

  /**
   * **Important field**
   *
   * Represents counts for `stopLat` (`stop_lat`)
   *
   * @description Latitude do ponto de embarque (GTFS)
   * @type `Record<float, number>`
   */
  stopLatCounts: Record<number, ITRCounts> = {};

  /**
   * **Important field**
   *
   * Represents counts for `stopLon` (`stop_lon`)
   *
   * @description Longitude do ponto de embarque (GTFS)
   * @type `Record<float, number>`
   */
  stopLonCounts: Record<number, ITRCounts> = {};

  /**
   * **Important field**
   *
   * Represents the sum of `transactionValue` (`valor_transacao`)
   *
   * @description Valor debitado na transação atual (R$)
   * type `float`
   */
  transactionValueSum = 0;

  /**
   * **Important field**
   *
   * Represents the sum of `transactionValue` (`valor_transacao`)
   *
   * @description Valor debitado na transação atual (R$)
   * type `float`
   */
  paidValueSum = 0;

  // Internal helper fields

  aux_epochWeek = 0;

  aux_nthWeeks: number[] = [];

  /**
   * The first valid date or datetime string of this group.
   * @example '2023-10-02T15:01:23.000Z'
   */
  aux_groupDateTime = '';

  isPago = false;

  /**
   * CNAB retorno error message list.
   */
  @SetValue((v) => Ocorrencia.toUserErrors(v))
  errors: Ocorrencia[] = [];

  getIsEmpty() {
    return !this.count;
  }

  /**
   * Apenas soma se status = pago
   */
  public static getAmountSum<T extends TicketRevenuesGroupDto>(data: T[]): number {
    return +data.reduce((sum, i) => sum + (i.transactionValueSum || 0), 0).toFixed(2);
  }
}
