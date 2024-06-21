import { Ocorrencia } from "src/cnab/entity/pagamento/ocorrencia.entity";

export class BankStatementDTO {
  constructor(dto?: BankStatementDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id: number;
  /**
   * feiday date.
   *
   * Format: `yyyy-mm-dd`
   */

  date: string;
  
  /**
   * Date when payment was made in bank.
   *
   * Format: `yyyy-mm-dd`
   */
  effectivePaymentDate: string | null;

  permitCode: string;
  cpfCnpj: string;
  amount: number;

  paidAmount: number;
  
  /** Payment status */
  status: string | null;
  
  /** Bank error message */
  errors: Ocorrencia[];
  
  // Debug
  ticketCount: number;
}
