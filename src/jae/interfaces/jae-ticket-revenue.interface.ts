export interface IJaeTicketRevenue {
  /** id_transacao */
  transactionId: number;

  /** id_tipo_pagamento */
  paymentMediaType?: string;

  /** id_tipo_integracao */
  transportIntegrationType?: string | null;

  /** id_tipo_transacao */
  transactionType?: string;

  /** datetime_transacao */
  transactionDateTime: string;

  /** valor_transacao */
  transactionValue: number;

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
  partitionDate: string;

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
