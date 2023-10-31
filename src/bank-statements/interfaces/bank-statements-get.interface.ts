import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';

export class IBankStatementsGet {
  startDate?: string;
  endDate?: string;
  timeInterval?: TimeIntervalEnum;
  userId?: number;
}
