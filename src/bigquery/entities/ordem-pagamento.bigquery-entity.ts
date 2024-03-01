export class BigqueryOrdemPagamento {
  /** Data da ordem de pagamento (partição) */
  data_ordem: Date;

  /** Data de pagamento da ordem */
  data_pagamento: Date;

  /** Nome  cadastro.consorcios */
  id_consorcio: string;

  /** Nome do consórcio */
  consorcio: string;

  /** Identificador da operadora na tabela cadastro.operadoras */
  id_operadora: string;

  /** Nome da operadora */
  operadora: string;

  /** Nome curto da linha operada com variação de serviço (ex: 010, 011SN, ...) */
  servico: string;

  /** Identificador da ordem pagamento no banco de dados da Jaé */
  id_ordem_pagamento: string;

  /** Identificador da ordem ressarcimento no banco de dados da Jaé */
  id_ordem_ressarcimento: string;

  /** Quantidade de transações feitas na modalidade débito */
  quantidade_transacao_debito: number;

  /** Valor total das transações feitas na modalidade débito (R$) */
  valor_debito: number;

  /** Quantidade de transações feitas em espécie */
  quantidade_transacao_especie: number;

  /** Valor total das transações feitas em espécie (R$) */
  valor_especie: number;

  /** Quantidade de transações feitas com gratuidade */
  quantidade_transacao_gratuidade: number;

  /** Valor total das transações feitas com gratuidade (R$) */
  valor_gratuidade: number;

  /** Quantidade de transações feitas com integração */
  quantidade_transacao_integracao: number;

  /** Valor total das transações feitas com integração (R$) */
  valor_integracao: number;

  /** Número de transações com rateio de crédito */
  quantidade_transacao_rateio_credito: number;

  /** Valor total das transações com rateio de crédito (R$) */
  valor_rateio_credito: number;

  /** Número de transações com rateio de débito */
  quantidade_transacao_rateio_debito: number;

  /** Valor total das transações com rateio de débito (R$) */
  valor_rateio_debito: number;

  /** Quantidade total de transações realizadas */
  quantidade_total_transacao: number;

  /** Valor total das transações realizadas (R$) */
  valor_total_transacao_bruto: number;

  /** Valor da taxa descontado do valor total (R$) */
  valor_desconto_taxa: number;

  /** Valor total das transações menos o valor_desconto_taxa (R$) */
  valor_total_transacao_liquido: number;

  /** Quantidade total de transações calculada pela captura de transações */
  quantidade_total_transacao_captura: number;

  /** Valor total das transações realizadas calculada pela captura de transações (R$) */
  valor_total_transacao_captura: number;

  /** Indicador de validação da ordem de pagamento */
  indicador_ordem_valida: boolean;

  /** Código de controle de versão do dado (SHA Github) */
  versao: string;

  aux_nextFriday: Date;
}
