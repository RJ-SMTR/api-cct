export class CreateTransacaoDto {
  id?: number;
  id_transacao?: string;
  dt_ordem: string;
  dt_pagamento: string;
  nome_consorcio: string;
  nome_operadora: string;
  servico: string;
  id_ordem_ressarcimento: number;
  qtde_transacao_rateio_credito: number;
  vlr_rateio_credito: number;
  qtde_transacao_rateio_debito: number;
  vlr_rateio_debito: number;
  quantidade_total_transacao: number;
  vlr_total_transacao_bruto: number;
  vlr_desconto_taxa: number;
  vlr_total_transacao_liquido: number;
  qtde_total_transacao_captura: number;
  vlr_total_transacao_captura: number;
  indicador_ordem_valida: string;
  id_pagador: number;
}
