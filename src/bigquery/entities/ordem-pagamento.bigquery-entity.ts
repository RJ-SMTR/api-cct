import { HttpStatus } from "@nestjs/common";
import { CommonHttpException } from "src/utils/http-exception/common-http-exception";

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

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getDataOrdem(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): string {
    if (!this.data_ordem) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'data_ordem', args);
    }
    return this.data_ordem;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getDataPagamento(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): string {
    if (!this.data_pagamento) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'data_pagamento', args);
    }
    return this.data_pagamento;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getConsorcio(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): string {
    if (!this.consorcio) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'consorcio', args);
    }
    return this.consorcio;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getOperadora(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): string {
    if (!this.operadora) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'operadora', args);
    }
    return this.operadora;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getServico(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): string {
    if (!this.servico) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'servico', args);
    }
    return this.servico;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getIdOrdemRessarcimento(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): string {
    if (!this.id_ordem_ressarcimento) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'id_ordem_ressarcimento', args);
    }
    return this.id_ordem_ressarcimento;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getQuantidadeTransacaoRateioCredito(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): number {
    if (this.quantidade_transacao_rateio_credito === null
      || this.quantidade_transacao_rateio_credito === undefined) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'quantidade_transacao_rateio_credito', args);
    }
    return this.quantidade_transacao_rateio_credito;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getValorRateioCredito(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): number {
    if (this.valor_rateio_credito === null
      || this.valor_rateio_credito === undefined) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'valor_rateio_credito', args);
    }
    return this.valor_rateio_credito;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getQuantidadeTransacaoRateioDebito(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): number {
    if (this.quantidade_transacao_rateio_debito === null
      || this.quantidade_transacao_rateio_debito === undefined) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'quantidade_transacao_rateio_debito', args);
    }
    return this.quantidade_transacao_rateio_debito;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getValorRateioDebito(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): number {
    if (this.valor_rateio_debito === null
      || this.valor_rateio_debito === undefined) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'valor_rateio_debito', args);
    }
    return this.valor_rateio_debito;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getQuantidadeTotalTransacao(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): number {
    if (this.quantidade_total_transacao === null
      || this.quantidade_total_transacao === undefined) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'quantidade_total_transacao', args);
    }
    return this.quantidade_total_transacao;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getValorTotalTransacaoBruto(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): number {
    if (this.valor_total_transacao_bruto === null
      || this.valor_total_transacao_bruto === undefined) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'valor_total_transacao_bruto', args);
    }
    return this.valor_total_transacao_bruto;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getValorDescontoTaxa(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): number {
    if (this.valor_desconto_taxa === null
      || this.valor_desconto_taxa === undefined) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'valor_desconto_taxa', args);
    }
    return this.valor_desconto_taxa;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getValorTotalTransacaoLiquido(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): number {
    if (this.valor_total_transacao_liquido === null
      || this.valor_total_transacao_liquido === undefined) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento', 'valor_total_transacao_liquido', args);
    }
    return this.valor_total_transacao_liquido;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getQuantidadeTotalTransacaoCaptura(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): number {
    if (this.quantidade_total_transacao_captura === null
      || this.quantidade_total_transacao_captura === undefined) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento',
        'quantidade_total_transacao_captura',
        args);
    }
    return this.quantidade_total_transacao_captura;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getValorTotalTransacaoCaptura(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): number {
    if (this.valor_total_transacao_captura === null
      || this.valor_total_transacao_captura === undefined) {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento',
        'valor_total_transacao_captura',
        args);
    }
    return this.valor_total_transacao_captura;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getIndicadorOrdemValida(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): boolean {
    if (typeof this.indicador_ordem_valida !== 'boolean') {
      throw CommonHttpException.invalidField(
        'BigqueryOrdemPagamento',
        'indicador_ordem_valida',
        args);
    }
    return this.indicador_ordem_valida;
  }
}
