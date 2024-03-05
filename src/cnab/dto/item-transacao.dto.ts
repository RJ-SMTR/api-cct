export class ItemTransacaoDTO {
  id_item_transacao: number;
  dt_transacao: Date;
  dt_processamento;
  dt_captura;
  modo: string;
  nome_consorcio: string;
  id_tipo_pagamento: number;
  tipo_transacao: string;
  valor_item_transacao: number;
  id_transacao: number;
  id_cliente_favorecido: number;
}
