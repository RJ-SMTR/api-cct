import { TRTimeIntervalEnum as TRTimeIntervalEnum } from '../enums/tr-time-interval.enum';

export interface ITRGetMeIndividualArgs {
  startDate?: string;
  endDate?: string;
  timeInterval?: TRTimeIntervalEnum;
  userId?: number;
}
