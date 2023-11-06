import { HttpException, HttpStatus } from '@nestjs/common';
import {
  endOfDay,
  isFriday,
  isSameDay,
  isSameMonth,
  nextDay,
  previousDay,
  startOfDay,
} from 'date-fns';
import { TimeIntervalEnum } from './enums/time-interval.enum';
import { WeekdayEnum } from './enums/weekday.enum';
import {
  DateIntervalType,
  NullableDateIntervalStrType,
} from './types/date-interval.type';

export const PAYMENT_WEEKDAY = WeekdayEnum._5_FRIDAY;
export const PAYMENT_START_WEEKDAY = WeekdayEnum._4_THURSDAY;
export const PAYMENT_END_WEEKDAY = WeekdayEnum._3_WEDNESDAY;

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

export function getDateIntervalFromStr(args: {
  startDateStr?: string;
  endDateStr?: string;
}): DateIntervalType {
  const now = new Date();

  let startDate: Date =
    args?.startDateStr !== undefined
      ? new Date(args.startDateStr)
      : new Date(now);

  let endDate: Date =
    args?.endDateStr !== undefined ? new Date(args.endDateStr) : new Date(now);

  startDate = startOfDay(startDate);
  endDate = endOfDay(endDate);

  return { startDate, endDate };
}

export function getPaymentDates(args: {
  startDateStr?: string;
  endDateStr: string;
}): DateIntervalType {
  if (args?.startDateStr !== undefined) {
    return safeCastDates(args);
  } else if (isFriday(new Date(args.endDateStr)) == false) {
    throw new HttpException(
      {
        error: 'endDate is not Friday.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
  let { startDate, endDate } = safeCastDates(args);
  if (isSameDay(startDate, endDate)) {
    startDate = previousPaymentStartDate(startDate);
    startDate = previousPaymentStartDate(startDate);
    endDate = previousPaymentEndDate(endDate);
  }

  return { startDate, endDate };
}

function safeCastDates(args: NullableDateIntervalStrType) {
  const now = new Date();
  let endDate: Date = new Date(now);
  if (args?.endDateStr !== undefined) {
    endDate = new Date(args.endDateStr);
  }

  let startDate: Date = new Date(now);
  if (args?.startDateStr) {
    startDate = new Date(args.startDateStr);
  }
  if (startDate > endDate) {
    startDate = new Date(endDate);
  }

  startDate = startOfDay(startDate);
  endDate = endOfDay(endDate);

  return { startDate, endDate };
}

export function getPaymentDatesFromTimeInterval(
  timeInterval: TimeIntervalEnum,
): DateIntervalType {
  const now = new Date(Date.now());
  let startDate: Date = previousPaymentStartDate(now, true);
  let endDate: Date = nextPaymentEndDate(now, {
    abortIfPaymentEndDate: false,
    goPreviousIfNextMonth: true,
  });

  if (timeInterval === TimeIntervalEnum.LAST_WEEK) {
    startDate.setDate(startDate.getDate() - 7);
  } else if (timeInterval === TimeIntervalEnum.LAST_2_WEEKS) {
    startDate.setDate(startDate.getDate() - 7 * 2);
  } else if (timeInterval === TimeIntervalEnum.LAST_MONTH) {
    startDate.setDate(startDate.getDate() - 7 * 4);
  }
  startDate = startOfDay(startDate);
  endDate = endOfDay(endDate);

  return { startDate, endDate };
}

if (require.main === module) {
  process.env.TZ = 'UTC';
  const ret = getPaymentDates({
    endDateStr: '2023-11-03',
  });
  console.log(ret);
}
