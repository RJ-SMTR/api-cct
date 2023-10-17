export interface IJaeTicketRevenueGroup {
  /** id_transacao */
  id: number;

  /** id_tipo_pagamento (group count) */
  paymentMediaTypeCount: {
    phone: number;
    card: number;
  };

  /** id_tipo_integracao (group count) */
  transportIntegrationTypeCount: {
    null: number;
    van: number;
    bus_supervia: number;
  };

  /** id_tipo_transacao (group count) */
  transactionTypeCount: {
    full: number;
    half: number;
    free: number;
  };

  /** datetime_transacao */
  transactionDateTime: string;

  /** valor_transacao (count) */
  transactionCount: number;

  /** valor_transacao (total) */
  transactionValueSum: number;

  /** latitude */
  transactionLat: number;

  /** longitude */
  transactionLon: number;

  /** id_veiculo */
  vehicleOrderNumberId: number;

  /** codigo_permissionario - it doesn't exist yet */
  permitCode: string;

  // Not needed fields below

  /** id_cliente */
  clientId: string;

  /** id_integracao */
  integrationId: number;

  /** id_integracao_individual */
  individualIntegrationId: number;

  /** data (partition, GMT0) */
  dateIndex: string;

  /** datetime_processamento */
  processingDateTime: string;

  /** datetime_captura */
  captureDateTime: string;

  /** servico */
  vehicleService: number;

  /** sentido */
  directionId: number;

  /** stop_id */
  stopId: string;

  /** stop_lat */
  stopLat: number;

  /** stop_lon */
  stopLon: number;
}
