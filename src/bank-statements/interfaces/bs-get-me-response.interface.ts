import { IBankStatement } from './bank-statement.interface';

export interface IBSGetMeResponse {
  amountSum: number;
  todaySum: number;
  count: number;
  ticketCount: number;
  data: IBankStatement[];
}
