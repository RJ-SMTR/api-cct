import { IBankStatement } from './bank-statement.interface';
import { IBSCounts } from './bs-counts.interface';

export class IBSGetMePreviousDaysResponse {
  statusCounts: Record<string, IBSCounts>;
  data: IBankStatement[];
}
