import { BankStatementDTO } from "../dtos/bank-statement.dto";

export interface IBSGetMeResponse {
  amountSum: number;
  todaySum: number;
  paidSum: number;
  count: number;
  ticketCount: number;
  data: BankStatementDTO[];
}
