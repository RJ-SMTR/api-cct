import { nextDay, previousDay } from 'date-fns';
import { WeekdayEnum } from './enums/weekday.enum';
import { TimeIntervalEnum } from './enums/time-interval.enum';

export const PAYMENT_WEEKDAY = WeekdayEnum._5_FRIDAY;
export const PAYMENT_START_WEEKDAY = WeekdayEnum._4_THURSDAY;
export const PAYMENT_END_WEEKDAY = WeekdayEnum._3_WEDNESDAY;

export function nextPaymentWeekday(date: Date): Date {
  return nextDay(date, PAYMENT_WEEKDAY);
}

export function getPaymentStartDate(date: Date): Date {
  let newDate = new Date(date);
  if (date.getUTCDay() !== PAYMENT_START_WEEKDAY) {
    newDate = previousDay(newDate, PAYMENT_START_WEEKDAY);
  }
  return newDate;
}

export function getPaymentEndDate(date: Date): Date {
  let newDate = new Date(date);
  if (date.getUTCDay() !== PAYMENT_END_WEEKDAY) {
    newDate = nextDay(newDate, PAYMENT_END_WEEKDAY);
  }
  return newDate;
}

export function getPaymentStartEndDates(args: {
  startDateStr?: string;
  endDateStr?: string;
  timeInterval?: TimeIntervalEnum;
}): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date =
    args?.startDateStr !== undefined
      ? new Date(args.startDateStr)
      : getPaymentStartDate(now);
  let endDate: Date =
    args?.endDateStr !== undefined
      ? new Date(args.endDateStr)
      : getPaymentEndDate(now);

  if (startDate.getDay() !== PAYMENT_START_WEEKDAY) {
    startDate = getPaymentStartDate(startDate);
  }
  if (endDate.getDay() !== PAYMENT_END_WEEKDAY) {
    endDate = getPaymentEndDate(endDate);
  }

  if (args.timeInterval && (!args?.startDateStr || !args?.endDateStr)) {
    if (args.timeInterval === TimeIntervalEnum.LAST_WEEK) {
      if (!args?.startDateStr) {
        startDate = getPaymentStartDate(now);
      }
      if (!args?.endDateStr) {
        endDate = getPaymentEndDate(now);
      }
    }
    if (args.timeInterval === TimeIntervalEnum.LAST_2_WEEKS) {
      if (!args?.startDateStr) {
        startDate = getPaymentStartDate(now);
        startDate.setDate(startDate.getDate() - 7);
      }
      if (!args?.endDateStr) {
        endDate = getPaymentEndDate(now);
      }
    }
    if (args.timeInterval === TimeIntervalEnum.LAST_MONTH) {
      if (!args?.startDateStr) {
        startDate = getPaymentStartDate(now);
        startDate.setDate(startDate.getDate() - 7 * 3);
      }
      if (!args?.endDateStr) {
        endDate = getPaymentEndDate(now);
      }
    }
  }
  return { startDate, endDate };
}
