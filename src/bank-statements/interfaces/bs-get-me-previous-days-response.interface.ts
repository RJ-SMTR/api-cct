import { BankStatementPreviousDaysDTO } from '../dtos/bank-statement-previous-days.dto';
import { IBSCounts } from './bs-counts.interface';

export class IBSGetMePreviousDaysResponse {
  statusCounts: Record<string, IBSCounts>;
  data: BankStatementPreviousDaysDTO[];
}
