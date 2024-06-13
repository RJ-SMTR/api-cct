import { BankStatementDTO } from '../dtos/bank-statement.dto';
import { IBSCounts } from './bs-counts.interface';

export class IBSGetMePreviousDaysResponse {
  statusCounts: Record<string, IBSCounts>;
  data: BankStatementDTO[];
}
