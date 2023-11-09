import { ICoreBankStatements } from 'src/core-bank/interfaces/core-bank-statements.interface';

export interface IBankStatementsResponse {
  amountSum: number;
  todaySum: number;
  data: ICoreBankStatements[];
}
