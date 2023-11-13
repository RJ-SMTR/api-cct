export interface IJaeTicketRevenue {
  /** internal control ID */
  id: number;

  /** id_transacao */ // OK
  transactionId: number;

  /** id_tipo_pagamento */ // OK
  paymentMediaType?: string;

  /** id_tipo_integracao */ // OK
  transportIntegrationType?: string | null;

  /** id_tipo_transacao */ // OK
  transactionType?: string;

  /** datetime_transacao */ // OK
  transactionDateTime: string;

  /** valor_transacao */ // OK
  transactionValue: number;

  /** latitude */ // OK
  transactionLat: number;

  /** longitude */ // OK
  transactionLon: number;

  /** id_veiculo */ // OK
  vehicleOrderNumberId: number;

  /** permissao */ // OK
  permitCode: string;

  // Not needed fields below

  /** id_cliente */ // OK
  clientId: string;

  /** id_integracao */ // OK
  integrationId: number;

  /**
   * id_integracao_individual
   * @deprecated this field doesnt exists anymore in bigquery
   */
  individualIntegrationId: number;

  /** `data` (partition, GMT0) */ // OK
  partitionDate: string;

  /** datetime_processamento */ // OK
  processingDateTime: string;

  /** datetime_captura */ // OK
  captureDateTime: string;

  /** servico */ // OK
  vehicleService: string;

  /** sentido */ // OK
  directionId: number;

  /** stop_id */ // OK
  stopId: string;

  /** stop_lat */ // OK
  stopLat: number;

  /** stop_lon */ // OK
  stopLon: number;
}
