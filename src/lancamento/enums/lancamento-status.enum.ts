export enum LancamentoStatus {
  /** Quando o Lançamento é criado, não há autorizações */
  _1_gerado = 'gerado',
  _2_autorizado_parcial = 'autorizado parcial',
  _3_autorizado = 'autorizado',
  _4_remessa_enviado = 'remessa enviado',
  _5_pago = 'pago',
  _6_erro = 'erro',
  /** Quando é feito o delete */
  _7_cancelado = 'cancelado',
}
