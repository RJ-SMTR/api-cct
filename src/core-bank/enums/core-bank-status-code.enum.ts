/**
 * Based on real world banking service.
 * @see {@link https://www.linknacional.com.br/blog/codigos-erro-retorno-cielo-api/ linknacional}
 */
export enum CoreBankStatusCodeEnum {
  AUTHORIZED = 0,
  UNAUTHORIZED_FRAUD_SUSPECT = 2,
  UNAUTHORIZED_PASSWORD_FAILED = 83,
  UNAUTHORIZED_CONNECTION_FAILED = 98,
}
