import { BankStatementDTO } from '../dtos/bank-statement.dto';

export interface IBSGetMeResponse {
  /** Soma do valor bruto */
  amountSum: number;
  /** Soma do valor pago */
  paidSum: number;
  /** Arrecadado hoje */
  todaySum: number;
  /** Desnecessário */
  count: number;
  /** Quantiade de passagens */
  ticketCount: number;
  /** Data do agregaod */
  data: BankStatementDTO[];
}
