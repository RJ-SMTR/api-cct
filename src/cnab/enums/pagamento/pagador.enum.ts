export enum PagadorContaEnum {
  /**
   * Only for items from Lancamento
   * .006........ = CNPJ
   */
  CETT = '000600071083',
  /**
   * Jaé. Only for items from OrdemPagamento.
   * .006........ = CNPJ
   */
  ContaBilhetagem = '000600071084',
  ContaRotativo = '000566697069',
}

export enum PgadorContaEnumKeys {
  cett = 'CETT',
  contaBilhetagem = 'ContaBilhetagem',
  contaRotativo = 'ContaRotativo',
}
