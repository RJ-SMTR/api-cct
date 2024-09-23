import { DateMonth } from 'src/utils/types/date-month.type';
import { SqlOperator } from '../types/sql-operator.type';

export interface SqlDateOperator {
  is?: Date;
  between?: [Date, Date];
  year?: number;
  month?: DateMonth;
  day?: [SqlOperator, number];
}
