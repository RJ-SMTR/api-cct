/**
 * Ticket revenues payment type map
 */
export const TRPaymentTypeMap = {
  1: 'Cartão',
  2: 'QRCode',
  3: 'NFC',
};
/**
 * Ticket revenues transaction type map
 *
 * Business rules:
 * - "Integral" = Débito + Botoeria (both are considered "Integral" type).
 * See {@link https://github.com/RJ-SMTR/api-cct/issues/177#issuecomment-1934531824 Issue #177, item 1 - GitHub}
 *
 * Matching id or literal values.
 * See {@link https://github.com/RJ-SMTR/api-cct/issues/168#issuecomment-1900546567 Issue #168 - GitHub}
 */
export const TRTransactionTypeMap = {
  /** Originally 1 = Débito */
  1: 'Integral',
  2: 'Recarga',
  98: 'Riocard',
  6: 'Bloqueio',
  /** Originally 99 = Botoeria */
  99: 'Integral',
  21: 'Gratuidade',
  3: 'Cancelamento',
  4: 'Integração',
  Débito: 'Integral',
  /** Botoeria = payment in cash */
  Botoeria: 'Integral',
};

/**
 * Ticket revenues integration type map
 */
export const TRIntegrationTypeMap = {
  3: 'Bu municipal',
  2: 'Integração',
  1: 'Transferência',
  0: 'Sem integração',
  4: 'Bu intermunicipal',
};
