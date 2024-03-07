
/**
 * Logic:
 * - It has 1 `id_ordem_pagamento` per day.
 * - id_ordem_pagamento repeats by combination of id_consorcio (CNPJ), id_operadora (CPF), servico (vehicle)
 */
export class BigqueryOrdemPagamento {
  /** Data da ordem de pagamento (partição) */
  dataOrdem: string | null;

  /** Data de pagamento da ordem */
  dataPagamento: string | null;

  /**
   *  Id de cadastro.consorcios
   * 
   * id_consorcio.cnpj = CNPJ
   */
  idConsorcio: string | null;

  /** Nome do consórcio */
  consorcio: string | null;

  /** 
   * Identificador da operadora na tabela cadastro.operadoras
   * 
   * id_operadora.documento = CPF
   */
  idOperadora: string | null;

  /** Nome da operadora */
  operadora: string | null;

  /** Nome curto da linha operada com variação de serviço (ex: 010, 011SN, ...) */
  servico: string | null;

  /** Identificador da ordem pagamento no banco de dados da Jaé */
  idOrdemPagamento: string | null;

  /** Identificador da ordem ressarcimento no banco de dados da Jaé */
  idOrdemRessarcimento: string | null;

  /** Quantidade de transações feitas na modalidade débito */
  quantidadeTransacaoDebito: number | null;

  /** Valor total das transações feitas na modalidade débito (R$) */
  valorDebito: number | null;

  /** Quantidade de transações feitas em espécie */
  quantidadeTransacaoEspecie: number | null;

  /** Valor total das transações feitas em espécie (R$) */
  valorEspecie: number | null;

  /** Quantidade de transações feitas com gratuidade */
  quantidadeTransacaoGratuidade: number | null;

  /** Valor total das transações feitas com gratuidade (R$) */
  valor_gratuidade: number | null;

  /** Quantidade de transações feitas com integração */
  quantidadeTransacaoIntegracao: number | null;

  /** Valor total das transações feitas com integração (R$) */
  valor_integracao: number | null;

  /** Número de transações com rateio de crédito */
  quantidadeTransacaoRateioCredito: number | null;

  /** Valor total das transações com rateio de crédito (R$) */
  valorRateioCredito: number | null;

  /** Número de transações com rateio de débito */
  quantidadeTransacaoRateioDebito: number | null;

  /** Valor total das transações com rateio de débito (R$) */
  valorRateioDebito: number | null;

  /** Quantidade total de transações realizadas */
  quantidadeTotalTransacao: number | null;

  /** Valor total das transações realizadas (R$) */
  valorTotalTransacaoBruto: number | null;

  /** Valor da taxa descontado do valor total (R$) */
  valorDescontoTaxa: number | null;

  /** Valor total das transações menos o valor_desconto_taxa (R$) */
  valorTotalTransacaoLiquido: number | null;

  /** Quantidade total de transações calculada pela captura de transações */
  quantidadeTotalTransacaoCaptura: number | null;

  /** Valor total das transações realizadas calculada pela captura de transações (R$) */
  valorTotalTransacaoCaptura: number | null;

  /** Indicador de validação da ordem de pagamento */
  indicadorOrdemValida: boolean | null;

  /** Código de controle de versão do dado (SHA Github) */
  versao: string | null;
}
