import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';

export interface ITRGetMeGroupedArgs {
  startDate?: string;
  endDate?: string;
  timeInterval?: TimeIntervalEnum;
  userId?: number;
  groupBy?: string;
}
