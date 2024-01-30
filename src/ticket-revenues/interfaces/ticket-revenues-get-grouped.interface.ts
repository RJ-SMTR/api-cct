import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';

export interface ITicketRevenuesGetGrouped {
  startDate?: string;
  endDate?: string;
  timeInterval?: TimeIntervalEnum;
  userId?: number;
  groupBy?: string;
}
