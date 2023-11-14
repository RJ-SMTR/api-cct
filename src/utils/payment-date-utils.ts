import { HttpException, HttpStatus } from '@nestjs/common';
import {
  endOfMonth,
  isFriday,
  isSameMonth,
  nextDay,
  nextFriday,
  previousDay,
  previousFriday,
  startOfMonth,
} from 'date-fns';
import { TimeIntervalEnum } from './enums/time-interval.enum';
import { WeekdayEnum } from './enums/weekday.enum';
import { DateIntervalType } from './types/date-interval.type';

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

//#region refactor

export function validateDateArgs(
  startDateStr?: string,
  endDateStr?: string,
  timeInterval?: TimeIntervalEnum,
): boolean {
  if (
    startDateStr === undefined &&
    endDateStr === undefined &&
    timeInterval === undefined
  ) {
    return false;
  } else {
    return true;
  }
}

export function getPaymentWeek(fridayDate: Date): {
  startDate: Date;
  endDate: Date;
} {
  const startDate = new Date(fridayDate);
  const endDate = new Date(fridayDate);
  startDate.setDate(startDate.getDate() - 8);
  endDate.setDate(endDate.getDate() - 2);
  return { startDate, endDate };
}

export function getPayment2Weeks(fridayDate: Date): {
  startDate: Date;
  endDate: Date;
} {
  const startDate = new Date(fridayDate);
  const endDate = new Date(fridayDate);
  startDate.setDate(startDate.getDate() - 8 - 7);
  endDate.setDate(endDate.getDate() - 2);
  return { startDate, endDate };
}

export function getPaymentMonth(
  fridayDate: Date,
  endpoint: string,
): {
  startDate: Date;
  endDate: Date;
} {
  if (endpoint === 'bank-statements') {
    return {
      startDate: startOfMonth(fridayDate),
      endDate: endOfMonth(fridayDate),
    };
  } else {
    // get first and last friday of month
    let startDate = startOfMonth(new Date(fridayDate));
    if (!isFriday(startDate)) {
      startDate = nextFriday(startDate);
    }
    let endDate = endOfMonth(new Date(fridayDate));
    if (!isFriday(endDate) && isSameMonth(endDate, nextFriday(endDate))) {
      endDate = nextFriday(endDate);
    } else if (!isFriday(endDate)) {
      endDate = previousFriday(endDate);
    }

    // get start end dates from each week
    startDate.setDate(startDate.getDate() - 8);
    endDate.setDate(endDate.getDate() - 2);

    return { startDate, endDate };
  }
}

export function getPaymentDates(
  endpoint: string,
  startDateStr?: string,
  endDateStr?: string,
  timeInterval?: TimeIntervalEnum,
): DateIntervalType {
  if (!validateDate(startDateStr, endDateStr, timeInterval)) {
    throw new HttpException(
      {
        error: 'invalid request.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  if (endDateStr && startDateStr) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    return { startDate, endDate };
  } else if (endDateStr && !startDateStr && !timeInterval) {
    let endDate = new Date(endDateStr);
    if (!isFriday(endDate)) {
      endDate = nextFriday(endDate);
    }
    return getPaymentWeek(endDate);
  } else if (timeInterval) {
    let endDate = new Date(endDateStr ? endDateStr : Date.now());
    if (!isFriday(endDate)) {
      endDate = nextFriday(endDate);
    }
    if (timeInterval === TimeIntervalEnum.LAST_WEEK) {
      return getPaymentWeek(endDate);
    } else if (timeInterval === TimeIntervalEnum.LAST_2_WEEKS) {
      return getPayment2Weeks(endDate);
    } else if (timeInterval === TimeIntervalEnum.LAST_MONTH) {
      return getPaymentMonth(endDate, endpoint);
    }
  }

  //
  else {
    throw new HttpException(
      {
        errors: {
          message: 'invalid request - unhandled combination',
          args: { startDateStr, endDateStr, timeInterval },
        },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
  return { startDate: new Date(), endDate: new Date() };
}

export function validateDate(
  startDateStr?: string,
  endDateStr?: string,
  timeInterval?: TimeIntervalEnum,
): boolean {
  if (
    startDateStr === undefined &&
    endDateStr === undefined &&
    timeInterval === undefined
  ) {
    return false;
  } else {
    return true;
  }
}

//#endregion refactor

if (require.main === module) {
  process.env.TZ = 'UTC';
  // const ret = getPaymentDates({
  //   endDateStr: '2023-11-03',
  // });
  // console.log(ret);
}
