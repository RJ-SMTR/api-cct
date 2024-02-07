import { User } from 'src/users/entities/user.entity';
import { TimeIntervalEnum } from 'src/utils/enums/time-interval.enum';
import { TRTimeIntervalEnum } from '../enums/tr-time-interval.enum';

export interface ITRGetMeIndividualArgs {
  startDate?: string;
  endDate?: string;
  timeInterval?: TRTimeIntervalEnum;
  userId?: number;
}

export interface ITRGetMeIndividualValidArgs {
  user: User;
  startDate?: string;
  endDate?: string;
  timeInterval?: TimeIntervalEnum;
}
