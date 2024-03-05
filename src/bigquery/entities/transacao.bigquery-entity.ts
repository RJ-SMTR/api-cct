export class BigqueryTransacao {
  id: number | null;
  data: string | null;
  hora: number | null;
  datetime_transacao: string | null;
  datetime_processamento: string | null;
  datetime_captura: string | null;
  modo: string | null;
  id_consorcio: string | null;
  /** Nome do consórcio */
  consorcio: string | null;
  id_operadora: string | null;
  /** Nome da operadora */
  operadora: string | null;
  servico: string | null;
  sentido: string | null;
  id_veiculo: number | null;
  id_cliente: string | null;
  id_transacao: string | null;
  tipo_pagamento: string | null;
  tipo_transacao: string | null;
  tipo_gratuidade: string | null;
  tipo_integracao: string | null;
  id_integracao: number | null;
  latitude: number | null;
  longitude: number | null;
  stop_id: number | null;
  stop_lat: number | null;
  stop_lon: number | null;
  valor_transacao: number | null;
  versao: string | null;
}
