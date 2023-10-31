import { endOfDay, startOfMonth } from 'date-fns';
import { TimeIntervalEnum } from './enums/time-interval.enum';

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

export function getDateNthWeek(dateInput: Date, startWeekday: number): number {
  const epochDate = new Date(1970, 0, 1);
  epochDate.setDate(
    epochDate.getDate() + getDaysToAdd(epochDate.getDay(), startWeekday),
  );
  const millisecondsDifference = dateInput.getTime() - epochDate.getTime();
  const millisecondsInAWeek = 7 * 24 * 60 * 60 * 1000;
  const nthWeekNumber =
    Math.floor(millisecondsDifference / millisecondsInAWeek) + 1;
  return nthWeekNumber;
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
