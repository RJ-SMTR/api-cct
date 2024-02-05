import { IBankStatement } from './bank-statement.interface';

export interface IGetBSResponse {
  todaySum: number;
  allSum: number;
  countSum: number;
  statements: IBankStatement[];
}
