import { IBankStatement } from './bank-statement.interface';

export interface IBankStatementsResponse {
  amountSum: number;
  todaySum: number;
  count: number;
  ticketCount: number;
  data: IBankStatement[];
}
