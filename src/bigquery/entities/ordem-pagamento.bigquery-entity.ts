/**
 * table: `ordem_pagamento_consorcio_operador_dia`
 *
 * Logic:
 * - It has 1 `id_ordem_pagamento` per day.
 * - id_ordem_pagamento repeats by combination of id_consorcio (CNPJ), id_operadora (CPF), servico (vehicle)
 */
export class BigqueryOrdemPagamento {
  // DATABASE COLUMNS

  /** Data da ordem de pagamento (partição) */
  dataOrdem: string;

  /**
   *  Id de cadastro.consorcios
   *
   * id_consorcio.cnpj = CNPJ
   */
  idConsorcio: string;

  /** Nome do consórcio */
  consorcio: string | null;

  /**
   * Identificador da operadora na tabela cadastro.operadoras
   *
   * id_operadora.documento = CPF
   */
  idOperadora: string;

  /** Nome da operadora */
  operadora: string | null;

  /** Identificador da ordem pagamento no banco de dados da Jaé */
  idOrdemPagamento: string;

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
  valorGratuidade: number | null;

  /** Quantidade de transações feitas com integração */
  quantidadeTransacaoIntegracao: number | null;

  /** Valor total das transações feitas com integração (R$) */
  valorIntegracao: number | null;

  /** Número de transações com rateio de crédito */
  quantidadeTransacaoRateioCredito: number | null;

  /** Valor total das transações com rateio de crédito (R$) */
  valorRateioCredito: number | null;

  /** Número de transações com rateio de débito */
  quantidadeTransacaoRateioDebito: number | null;

  /** Valor total das transações com rateio de débito (R$) */
  valorRateioDebito: number | null;

  /** Valor total das transações realizadas (R$) */
  valorTotalTransacaoBruto: number | null;

  /** Valor da taxa descontado do valor total (R$) */
  valorDescontoTaxa: number | null;

  /** Valor total das transações menos o valor_desconto_taxa (R$) */
  valorTotalTransacaoLiquido: number | null;

  operadoraTipoDocumento: string;

  /** Código de controle de versão do dado (SHA Github) */
  versao: string;

  public static getGroupId(ordem: BigqueryOrdemPagamento) {
    return `${ordem.idOrdemPagamento},${ordem.idConsorcio},${ordem.idOperadora}`;
  }
}
