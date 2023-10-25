import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';

export interface ITicketRevenuesGetUngrouped {
  startDate?: string;
  endDate?: string;
  timeInterval?: TimeIntervalEnum;
}
