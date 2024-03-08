import { User } from 'src/users/entities/user.entity';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { BSMePrevDaysTimeIntervalEnum } from '../enums/bs-me-prev-days-time-interval.enum';

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
