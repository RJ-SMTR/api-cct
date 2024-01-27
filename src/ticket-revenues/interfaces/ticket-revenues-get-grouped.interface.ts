import { BSTimeIntervalEnum } from 'src/utils/enums/time-interval.enum';

export interface ITicketRevenuesGetGrouped {
  startDate?: string;
  endDate?: string;
  timeInterval?: BSTimeIntervalEnum;
  userId?: number;
  groupBy?: string;
}
