import { HttpException, HttpStatus } from '@nestjs/common';
import {
  isFriday,
  isSameDay,
  isSameMonth,
  nextDay,
  previousDay
} from 'date-fns';
import { safeCastDates } from './date-utils';
import { TimeIntervalEnum } from './enums/time-interval.enum';
import { WeekdayEnum } from './enums/weekday.enum';
import {
  DateIntervalStrType,
  DateIntervalType,
} from './types/date-interval.type';

export const PAYMENT_WEEKDAY = WeekdayEnum._5_FRIDAY;
export const PAYMENT_START_WEEKDAY = WeekdayEnum._4_THURSDAY;
export const PAYMENT_END_WEEKDAY = WeekdayEnum._3_WEDNESDAY;

// #region nextPrevious

export function previousPaymentWeekday(
  date: Date,
  abortIfWeekday = false,
): Date {
  if (date.getDay() !== PAYMENT_WEEKDAY || !abortIfWeekday) {
    return previousDay(date, PAYMENT_WEEKDAY);
  }
  return date;
}

export function nextPaymentWeekday(date: Date, abortIfWeekday = false): Date {
  if (date.getDay() !== PAYMENT_WEEKDAY || !abortIfWeekday) {
    return nextDay(date, PAYMENT_WEEKDAY);
  }
  return date;
}

export function previousPaymentStartDate(
  date: Date,
  abortIfPaymentStartWeekday = false,
): Date {
  let newDate = new Date(date);
  if (date.getDay() !== PAYMENT_START_WEEKDAY || !abortIfPaymentStartWeekday) {
    newDate = previousDay(newDate, PAYMENT_START_WEEKDAY);
  }
  return newDate;
}

export function previousPaymentEndDate(
  date: Date,
  args?: {
    abortIfPaymentEndDate?: boolean;
    abortIfPreviousMonth?: boolean;
  },
): Date {
  let newDate = new Date(date);
  if (date.getDay() !== PAYMENT_END_WEEKDAY || !args?.abortIfPaymentEndDate) {
    newDate = previousDay(newDate, PAYMENT_END_WEEKDAY);
  }
  if (!isSameMonth(date, newDate) && args?.abortIfPreviousMonth) {
    return date;
  }
  return newDate;
}

export function nextPaymentEndDate(
  date: Date,
  args?: {
    abortIfPaymentEndDate?: boolean;
    goPreviousIfNextMonth?: boolean;
  },
): Date {
  let newDate = new Date(date);
  if (date.getDay() !== PAYMENT_END_WEEKDAY || !args?.abortIfPaymentEndDate) {
    newDate = nextDay(newDate, PAYMENT_END_WEEKDAY);
  }
  if (!isSameMonth(date, newDate) && args?.goPreviousIfNextMonth) {
    return previousPaymentEndDate(new Date(date), {
      abortIfPaymentEndDate: args?.abortIfPaymentEndDate,
    });
  }
  return newDate;
}

// #endregion nextPrevious

// #region dateInterval

/**
* @param args Is assumed that `startDate` is already at last_week
*/
export function getDatesFromTimeInterval(args: {
  startDate: Date;
  endDate: Date;
  timeInterval?: TimeIntervalEnum | null;
}): DateIntervalType {
  const { startDate, endDate } = args;
  if (args.timeInterval === TimeIntervalEnum.LAST_WEEK) {
    startDate.setDate(startDate.getDate());
  }
  if (args.timeInterval === TimeIntervalEnum.LAST_2_WEEKS) {
    startDate.setDate(startDate.getDate() - 7);
  }
  if (args.timeInterval === TimeIntervalEnum.LAST_MONTH) {
    startDate.setDate(startDate.getDate() - 7 * 3);
  }
  return { startDate, endDate };
}

export function getPaymentDates(args: {
  timeInterval?: TimeIntervalEnum;
  endDateStr: string;
  startDateStr?: string;
}): DateIntervalType {
  if (args?.timeInterval !== undefined) {
    return goPreviousDays(args);
  } else if (
    args?.startDateStr !== undefined &&
    args?.endDateStr !== undefined
  ) {
    return safeCastDates(args);
  } else if (
    args?.endDateStr !== undefined &&
    !isFriday(new Date(args.endDateStr))
  ) {
    throw new HttpException(
      {
        error: 'endDate is not Friday.',
      },
      HttpStatus.BAD_REQUEST,
    );
  } else if (args?.endDateStr !== undefined) {
    return goPreviousDays({
      ...args,
      ...safeCastDates(args),
    });
  } else {
    throw new HttpException(
      {
        error: 'invalid request.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export function goPreviousDays(args: Partial<DateIntervalStrType>): DateIntervalType {
  let { startDate, endDate } = safeCastDates(args);
  if (isSameDay(startDate, endDate)) {
    startDate = previousPaymentStartDate(startDate);
    startDate = previousPaymentStartDate(startDate);
    endDate = previousPaymentEndDate(endDate);
  }
  return { startDate, endDate };
}

// #endregion dateInterval

if (require.main === module) {
  process.env.TZ = 'UTC';
  // const ret = getPaymentDates({
  //   endDateStr: '2023-11-03',
  // });
  // console.log(ret);
}
