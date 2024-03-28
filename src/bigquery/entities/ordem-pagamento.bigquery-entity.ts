import { TipoFavorecidoEnum } from "src/tipo-favorecido/tipo-favorecido.enum";

/**
 * Logic:
 * - It has 1 `id_ordem_pagamento` per day.
 * - id_ordem_pagamento repeats by combination of id_consorcio (CNPJ), id_operadora (CPF), servico (vehicle)
 */
export class BigqueryOrdemPagamento {

  // DATABASE COLUMNS

  /** Data da ordem de pagamento (partição) */
  dataOrdem: string | null;

  /** Data de pagamento da ordem */
  dataPagamento: string | null;

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

  /** Nome curto da linha operada com variação de serviço (ex: 010, 011SN, ...) */
  servico: string;

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
  versao: string;

  // CUSTOM COLUMNS

  /** consorcios.cnpj */
  consorcioCpfCnpj: string | null;

  /** operadora.documento (cpf/cnpj) */
  operadoraCpfCnpj: string | null;

  /** 
   * Identify permissionarioRole form data content
   * 
   * Rules: see {@link https://github.com/RJ-SMTR/api-cct/issues/207#issuecomment-1984421700 #207, item 8}
   */
  tipoFavorecido: TipoFavorecidoEnum | null;
}
