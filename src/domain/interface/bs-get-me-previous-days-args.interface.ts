import { BSMePrevDaysTimeIntervalEnum } from '../enum/bs-me-prev-days-time-interval.enum';
import { User } from '../entity/user.entity';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';

export class IBSGetMePreviousDaysArgs {
  endDate?: string;
  timeInterval?: BSMePrevDaysTimeIntervalEnum;
  userId?: number;
}

export class IBSGetMePreviousDaysValidArgs {
  user: User;
  endDate: string;
  timeInterval?: TimeIntervalEnum;
}
