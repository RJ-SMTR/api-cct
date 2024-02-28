export class BigqueryTransacao {
  id: number;
  data: Date;
  hora: number;
  datetime_transacao: Date;
  datetime_processamento: Date;
  datetime_captura: Date;
  modo: string;
  id_consorcio: string;
  /** Nome do consórcio */
  consorcio: string;
  id_operadora: string;
  /** Nome da operadora */
  operadora: string;
  servico: string;
  sentido: string;
  id_veiculo: number;
  id_cliente: string;
  id_transacao: string;
  tipo_pagamento: string;
  tipo_transacao: string;
  tipo_gratuidade: string;
  tipo_integracao: string;
  id_integracao: number;
  latitude: number;
  longitude: number;
  stop_id: number;
  stop_lat: number;
  stop_lon: number;
  valor_transacao: number;
  versao: string;
}
