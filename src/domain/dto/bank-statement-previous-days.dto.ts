import { Ocorrencia } from "src/domain/entity/ocorrencia.entity";
import { SetValue } from "src/utils/decorators/set-value.decorator";

export class BankStatementPreviousDaysDTO {
  constructor(dto?: BankStatementPreviousDaysDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id: number;

  /**
   * date for reference - e.g. friday date, month date.
   *
   * Format: `yyyy-mm-dd`
   */
  date: string;

  paymentOrderDate: string;

  /**
   * Date when payment was made in bank.
   *
   * Format: `yyyy-mm-dd`
   */
  effectivePaymentDate: string | null;

  transactionDate: string;
  processingDate: string;

  permitCode: string;
  cpfCnpj: string;
  amount: number;

  paidAmount: number;

  /** Payment status */
  status: string | null;

  /** Bank error message */
  @SetValue((v) => Ocorrencia.toUserValues(v))
  errors: Ocorrencia[];

  // Debug
  ticketCount: number;
}
