import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';

export class IBSGetMeArgs {
  yearMonth: Date;
  timeInterval?: TimeIntervalEnum;
  userId?: number;
}
