import { BSTimeIntervalEnum } from 'src/utils/enums/time-interval.enum';

export class IBSGetMeArgs {
  startDate?: string;
  endDate?: string;
  timeInterval?: BSTimeIntervalEnum;
  userId?: number;
}
