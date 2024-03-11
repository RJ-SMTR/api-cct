import { IsDateString, IsNotEmpty, IsNumber, IsString, ValidateIf } from "class-validator";

/**
 * Logic:
 * - It has 1 `id_ordem_pagamento` per day.
 * - id_ordem_pagamento repeats by combination of id_consorcio (CNPJ), id_operadora (CPF), servico (vehicle)
 */
export class BigqueryOrdemPagamentoDTO {

  /** 
   * Data da ordem de pagamento (partição)
   * 
   * Para filtrar e ordenar por data	
   */
  @IsNotEmpty()
  @IsDateString()
  dataOrdem: string;

  /** 
   * Data de pagamento da ordem
   * 
   * Se a dataPagamento for nula, iremos efetuar o pagamento.
   * Senão, ignoramos o item.	
   */
  @ValidateIf((o, v) => v !== null)
  @IsDateString()
  dataPagamento: string | null;

  /**
   * Id de cadastro.consorcios
   *
   * id_consorcio.cnpj = CNPJ
   */
  @IsNotEmpty()
  @IsString()
  idConsorcio: string;

  /** Nome do consórcio, para referência */
  consorcio: string;

  /** 
   * Identificador da operadora na tabela cadastro.operadoras
   * 
   * id_operadora.documento = CPF
   */
  idOperadora: string;

  /** Nome da operadora */
  operadora: string;

  /** Nome curto da linha operada com variação de serviço (ex: 010, 011SN, ...) */
  servico: string | null;

  /**
   * Identificador da ordem pagamento no banco de dados da Jaé
   * 
   * Agrupamos um arquivo CNAB por id_ordem_pagamento.
   * 
   * Cada **data_ordem** possui um id_ordem_pagamento único.
   * Cada **id_ordem_pagamento** possui vários **id_operadora** (favorecido CPF),
   * **id_consorico** (favorecido CNPJ) e **servico** (veículo que arrecadou)
   */
  @IsNotEmpty()
  @IsString()
  idOrdemPagamento: string;

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
  @IsNotEmpty()
  @IsNumber()
  valorTotalTransacaoBruto: number;

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
