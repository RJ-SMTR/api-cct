import { BankStatementDTO } from '../dto/bank-statement.dto';

export interface IGetBSResponse {
  todaySum: number;
  allSum: number;
  countSum: number;
  statements: BankStatementDTO[];
}
