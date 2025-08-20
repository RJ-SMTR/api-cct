import { readFileSync } from "fs";

export class BigqueryTransacao {
  id: number | null;
  data: string | null;
  hora: number | null;
  datetime_transacao: string;
  datetime_processamento: string | null;
  datetime_captura: string | null;
  modo: string;
  id_consorcio: string;
  /** Nome do consórcio */
  consorcio: string;
  id_operadora: string;
  operadoraCpfCnpj: string | null;
  consorcioCnpj: string | null;
  /** Nome da operadora */
  operadora: string;
  servico: string | null;
  sentido: string | null;
  id_veiculo: number | null;
  id_cliente: string | null;
  id_transacao: string;
  tipo_pagamento: string;
  tipo_transacao: string | null;
  tipo_transacao_smtr: string | null;
  tipo_gratuidade: string | null;
  tipo_integracao: string | null;
  id_integracao: number | null;
  latitude: number | null;
  longitude: number | null;
  stop_id: number | null;
  stop_lat: number | null;
  stop_lon: number | null;
  valor_transacao: number;
  valor_pagamento: number;
  versao: string | null;
  id_ordem_pagamento: number | null;

  public static fromJson(absPath: string) {
    const file = readFileSync(absPath, 'utf8');
    const obj: BigqueryTransacao[] = JSON.parse(file);
    return obj;
  }



}