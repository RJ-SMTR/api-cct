import { BSTimeIntervalEnum } from '../enums/time-interval.enum';

export type DateIntervalArgsType = {
  startDate: Date;
  endDate: Date;
  timeInterval: BSTimeIntervalEnum;
};
export type DateIntervalType = { startDate: Date; endDate: Date };
export type NullableDateIntervalType = { startDate?: Date; endDate?: Date };
export type DateIntervalStrType = {
  startDateStr?: string;
  endDateStr?: string;
};
