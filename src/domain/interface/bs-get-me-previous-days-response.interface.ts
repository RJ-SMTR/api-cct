import { BankStatementPreviousDaysDTO } from '../dto/bank-statement-previous-days.dto';
import { IBSCounts } from './bs-counts.interface';

export class IBSGetMePreviousDaysResponse {
  /** Valor pago */
  paidValue: number;
  /** Valor a pagar */
  toPayValue: number;
  /** Valor com erro */
  pendingValue: number;
  statusCounts: Record<string, IBSCounts>;
  data: BankStatementPreviousDaysDTO[];
}
