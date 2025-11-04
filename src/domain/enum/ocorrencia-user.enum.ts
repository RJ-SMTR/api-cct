export enum OcorrenciaUserEnum {
  /** Este código indica que o pagamento foi confirmado  */
  'AG' = 'Agência/Conta corrente/DV inválido',
  'AL' = 'Código do banco favorecido ou depositário inválido',
  'AM' = 'Agência mantenedora da conta corrente do favorecido inválida',
  'AN' = 'Conta Corrente / DV do favorecido inválido',
  'AO' = 'Nome do favorecido não informado',
  'AS' = 'Aviso ao favorecido - identificação inválida',
  'BG' = 'Agência/conta impedida legalmente',
  'DA' = 'Beneficiário não cadastrado',
  'DB' = 'Situação do beneficiário não permite pagamento',
  /** As ocorrências iniciadas com'ZA' têm caráter informativo para o cliente  */
  'ZA' = 'Agência/conta do favorecido substituída',
  'ZY' = 'Pagamento Rejeitado - Beneficiário Divergente',
  '02' = 'Crédito ou Débito Cancelado pelo Pagador/Credor',
}

export type ocorrenciaUserTyppe =
  | 'AG'
  | 'AL'
  | 'AM'
  | 'AN'
  | 'AO'
  | 'AS'
  | 'BG'
  | 'DA'
  | 'DB'
  | '  ';
