import { BSMePrevDaysTimeIntervalEnum } from '../enums/bs-me-prev-days-time-interval.enum';

export class IBSGetMePreviousDaysArgs {
  endDate?: string;
  timeInterval?: BSMePrevDaysTimeIntervalEnum;
  userId?: number;
}
