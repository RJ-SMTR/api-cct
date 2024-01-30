import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';

export class IBSGetMeArgs {
  startDate?: string;
  endDate?: string;
  timeInterval?: TimeIntervalEnum;
  userId?: number;
}
