export enum StatusPagamento {
  PAGO = 'Pago',
  ERRO_ESTORNO = 'Estorno',
  ERRO_REJEITADO = 'Rejeitado',
  AGUARDANDO_PAGAMENTO = 'Aguardando Pagamento',
  PENDENCIA_PAGA = 'Pendencia Paga',
  PENDENTES = 'Pendentes',
  A_PAGAR = 'A Pagar',
  // Guardador only: payment reduced (or zeroed) by the discount of a pagamento indevido (abatimento-duplicidade.ts).
  ABATIMENTO_DUPLICIDADE = 'Abatimento por duplicidade',
}
