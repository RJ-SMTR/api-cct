export class BigqueryOrdemPagamento {
  /** Data da ordem de pagamento (partição) */
  data_ordem: string | null;

  /** Data de pagamento da ordem */
  data_pagamento: string | null;

  /** Nome  cadastro.consorcios */
  id_consorcio: string | null;

  /** Nome do consórcio */
  consorcio: string | null;

  /** Identificador da operadora na tabela cadastro.operadoras */
  id_operadora: string | null;

  /** Nome da operadora */
  operadora: string | null;

  /** Nome curto da linha operada com variação de serviço (ex: 010, 011SN, ...) */
  servico: string | null;

  /** Identificador da ordem pagamento no banco de dados da Jaé */
  id_ordem_pagamento: string | null;

  /** Identificador da ordem ressarcimento no banco de dados da Jaé */
  id_ordem_ressarcimento: string | null;

  /** Quantidade de transações feitas na modalidade débito */
  quantidade_transacao_debito: number | null;

  /** Valor total das transações feitas na modalidade débito (R$) */
  valor_debito: number | null;

  /** Quantidade de transações feitas em espécie */
  quantidade_transacao_especie: number | null;

  /** Valor total das transações feitas em espécie (R$) */
  valor_especie: number | null;

  /** Quantidade de transações feitas com gratuidade */
  quantidade_transacao_gratuidade: number | null;

  /** Valor total das transações feitas com gratuidade (R$) */
  valor_gratuidade: number | null;

  /** Quantidade de transações feitas com integração */
  quantidade_transacao_integracao: number | null;

  /** Valor total das transações feitas com integração (R$) */
  valor_integracao: number | null;

  /** Número de transações com rateio de crédito */
  quantidade_transacao_rateio_credito: number | null;

  /** Valor total das transações com rateio de crédito (R$) */
  valor_rateio_credito: number | null;

  /** Número de transações com rateio de débito */
  quantidade_transacao_rateio_debito: number | null;

  /** Valor total das transações com rateio de débito (R$) */
  valor_rateio_debito: number | null;

  /** Quantidade total de transações realizadas */
  quantidade_total_transacao: number | null;

  /** Valor total das transações realizadas (R$) */
  valor_total_transacao_bruto: number | null;

  /** Valor da taxa descontado do valor total (R$) */
  valor_desconto_taxa: number | null;

  /** Valor total das transações menos o valor_desconto_taxa (R$) */
  valor_total_transacao_liquido: number | null;

  /** Quantidade total de transações calculada pela captura de transações */
  quantidade_total_transacao_captura: number | null;

  /** Valor total das transações realizadas calculada pela captura de transações (R$) */
  valor_total_transacao_captura: number | null;

  /** Indicador de validação da ordem de pagamento */
  indicador_ordem_valida: boolean | null;

  /** Código de controle de versão do dado (SHA Github) */
  versao: string | null;
}
