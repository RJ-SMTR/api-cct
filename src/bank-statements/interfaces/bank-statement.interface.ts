export interface IBankStatement {
  id: number;
  /**
   * Date of reading this data.
   *
   * Format: `yyyy-mm-dd`
   */

  date: string;
  /**
   * Date of scheduled payment.
   *
   * Format: `yyyy-mm-dd`
   */
  paymentOrderDate: string;

  /**
   * Date when payment was made.
   *
   * Format: `yyyy-mm-dd`
   */
  effectivePaymentDate: string | null;

  permitCode: string;
  cpfCnpj: string;
  amount: number;

  /** Business status message */
  status: string;
  /** Business status code */
  statusCode: string;

  bankStatus: string | null;
  bankStatusCode: string | null;

  /** Bank error message */
  error: string | null;

  /** Bank error code */
  errorCode: string | null;
}
