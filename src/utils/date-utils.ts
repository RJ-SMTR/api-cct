import { HttpStatus } from '@nestjs/common';
import {
  endOfDay,
  format,
  isDate,
  nextFriday,
  parse,
  startOfDay,
  startOfMonth,
  subHours,
} from 'date-fns';
import { TimeIntervalEnum } from './enums/time-interval.enum';
import { CommonHttpException } from './http-exception/common-http-exception';
import { DateIntervalStrType } from './types/date-interval.type';

export function getDateWithTimezone(
  date: Date,
  offsetHours: number,
  offsetMinutes = 0,
): Date {
  const _date = new Date(date);
  _date.setUTCHours(
    _date.getUTCHours() + offsetHours,
    _date.getUTCMinutes() + offsetMinutes,
  );
  return _date;
}

function getDaysToAdd(currentWeekday: number, desiredWeekday: number) {
  currentWeekday = (currentWeekday + 7) % 7;
  desiredWeekday = (desiredWeekday + 7) % 7;
  const daysToAdd = (desiredWeekday - currentWeekday + 7) % 7;
  return daysToAdd;
}

export function getNthWeek(dateInput: Date, startDay: number): number {
  const epochDate = new Date(1970, 0, 4);
  const epochStartDay = epochDate.getDay();
  epochDate.setDate(
    epochDate.getDate() + getDaysToAdd(epochStartDay, startDay),
  );
  const millisecondsDifference = dateInput.getTime() - epochDate.getTime();
  const millisecondsInAWeek = 7 * 24 * 60 * 60 * 1000;
  const nthWeekNumber =
    Math.floor(millisecondsDifference / millisecondsInAWeek) + 1;
  return nthWeekNumber;
}

export function isSameNthWeek(date1: Date, date2: Date, startDay: number) {
  const nthWeek1 = getNthWeek(date1, startDay);
  const nthWeek2 = getNthWeek(date2, startDay);
  return nthWeek1 === nthWeek2;
}

export function getStartEndDates(args: {
  startDateStr?: string;
  endDateStr?: string;
  timeInterval?: TimeIntervalEnum;
}): { startDate: Date; endDate: Date } {
  const now = new Date(Date.now());
  let startDate: Date =
    args?.startDateStr !== undefined
      ? new Date(args.startDateStr)
      : new Date(now);
  let endDate: Date =
    args?.endDateStr !== undefined ? new Date(args.endDateStr) : new Date(now);

  if (args.timeInterval && !args?.startDateStr) {
    if (args.timeInterval === TimeIntervalEnum.LAST_WEEK) {
      startDate.setDate(startDate.getDate() - 7);
    }
    if (args.timeInterval === TimeIntervalEnum.LAST_2_WEEKS) {
      startDate.setDate(startDate.getDate() - 14);
    }
    if (args.timeInterval === TimeIntervalEnum.LAST_MONTH) {
      startDate = startOfMonth(startDate);
    }
  }
  endDate = endOfDay(endDate);
  return { startDate, endDate };
}

export function isPaymentWeekComplete(date: Date) {
  const today = new Date(Date.now());
  const paymentDate = nextFriday(date);
  const currentPaymentDate = nextFriday(today);
  return paymentDate < currentPaymentDate && today >= paymentDate;
}

export function safeCastDates(args: Partial<DateIntervalStrType>) {
  const now = new Date();
  let endDate: Date = new Date(now);
  if (args?.endDateStr !== undefined) {
    endDate = new Date(args.endDateStr);
  }

  let startDate: Date = new Date(endDate);
  if (args?.startDateStr !== undefined) {
    startDate = new Date(args.startDateStr);
  }
  if (startDate > endDate) {
    startDate = new Date(endDate);
  }

  startDate = startOfDay(startDate);
  endDate = endOfDay(endDate);

  return { startDate, endDate };
}

/**
 * Get date in format `YYYY-MM-DD`
 */
export function getDateYMDString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns new Date() using allowed date string values.
 *
 * And also allows "hh:mm:ss" ( year, month, day values are from now() );
 *
 * @param inputFormat date-fns date format. (see {@link https://date-fns.org/v3.3.1/docs/format})
 */
export function getDateFromString(
  value: string,
  inputFormat?: string,
  throwIfInvalid = true,
): Date {
  let date = inputFormat
    ? parse(value, inputFormat, new Date())
    : new Date(value);
  if (isNaN(date.getDate())) {
    date = new Date(`${format(new Date(), 'yyyy-MM-dd')} ${value}`);
  }
  if (throwIfInvalid && isNaN(date.getDate())) {
    throw CommonHttpException.details(
      `Invalid date format (value: ${value}, inputFormat: ${inputFormat})`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
  return date;
}

export function getBRTFromUTC(utc: Date): Date {
  return subHours(utc, 3);
}

export function isValidDate(value: any): boolean {
  return isDate(value) && value instanceof Date && !isNaN(value.getDate());
}

/**
 * Converts year-month=day string into Date with correct weekday
 *
 * @param ymd Example: `2024-05-10`
 */
export function yearMonthDayToDate(ymd: string) {
  return new Date(ymd + ' ');
}
