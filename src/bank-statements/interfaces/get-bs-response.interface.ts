import { BankStatementDTO } from '../dtos/bank-statement.dto';

export interface IGetBSResponse {
  todaySum: number;
  allSum: number;
  countSum: number;
  statements: BankStatementDTO[];
}
