import { HttpException, HttpStatus } from '@nestjs/common';
import {
  endOfDay,
  isFriday,
  isSameMonth,
  nextFriday,
  previousFriday,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';
import { TimeIntervalEnum } from './enums/time-interval.enum';
import { WeekdayEnum } from './enums/weekday.enum';
import { DateIntervalType } from './types/date-interval.type';

export const PAYMENT_WEEKDAY = WeekdayEnum._5_FRIDAY;
export const PAYMENT_START_WEEKDAY = WeekdayEnum._4_THURSDAY;
export const PAYMENT_END_WEEKDAY = WeekdayEnum._3_WEDNESDAY;
export type PaymentEndpointType = 'bank-statements' | 'ticket-revenues';

/**
 * From friday get starting thursday and ending wednesday
 */
export function getPaymentWeek(
  fridayDate: Date,
  endpoint: PaymentEndpointType = 'ticket-revenues',
): { startDate: Date; endDate: Date } {
  if (endpoint === 'ticket-revenues') {
    return {
      startDate: subDays(startOfDay(new Date(fridayDate)), 8),
      endDate: subDays(endOfDay(new Date(fridayDate)), 2),
    };
  } else {
    return {
      startDate: fridayDate,
      endDate: fridayDate,
    };
  }
}

export function getPayment2Weeks(
  fridayDate: Date,
  endpoint: PaymentEndpointType,
): {
  startDate: Date;
  endDate: Date;
} {
  if (endpoint === 'ticket-revenues') {
    return {
      startDate: subDays(startOfDay(new Date(fridayDate)), 15),
      endDate: subDays(endOfDay(new Date(fridayDate)), 2),
    };
  } else {
    return {
      startDate: subDays(startOfDay(new Date(fridayDate)), 7),
      endDate: endOfDay(new Date(fridayDate)),
    };
  }
}

export function getPaymentMonth(
  fridayDate: Date,
  endpoint: PaymentEndpointType,
): {
  startDate: Date;
  endDate: Date;
} {
  if (endpoint === 'bank-statements') {
    // get first and current fridays of month
    let startDate = startOfMonth(fridayDate);
    if (!isFriday(startDate)) {
      startDate = nextFriday(startDate);
    }
    const endDate = new Date(fridayDate);
    return { startDate, endDate };
  } else {
    // get first and current friday of month
    let startDate = startOfMonth(new Date(fridayDate));
    if (!isFriday(startDate)) {
      startDate = nextFriday(startDate);
    }
    const endDate = new Date(fridayDate);

    // get start end dates from each week
    startDate.setDate(startDate.getDate() - 8);
    endDate.setDate(endDate.getDate() - 2);

    return { startDate, endDate };
  }
}

export function getPaymentDates(args: {
  endpoint: PaymentEndpointType;
  startDateStr?: string;
  endDateStr?: string;
  timeInterval?: TimeIntervalEnum;
}): DateIntervalType {
  const { endpoint, endDateStr, startDateStr, timeInterval } = args;

  if (!validateDate(startDateStr, endDateStr, timeInterval)) {
    throw new HttpException(
      {
        error: 'Invalid request.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  if (endDateStr && startDateStr) {
    if (endpoint === 'ticket-revenues') {
      return {
        startDate: new Date(startDateStr),
        endDate: endOfDay(new Date(endDateStr)),
      };
    } else {
      return {
        startDate: nextFriday(new Date(startDateStr)),
        endDate: nextFriday(endOfDay(new Date(endDateStr))),
      };
    }
  } else if (endDateStr && !startDateStr && !timeInterval) {
    let endDate = endOfDay(new Date(endDateStr));
    if (!isFriday(endDate)) {
      endDate = nextFriday(endDate);
    }
    return getPaymentWeek(endDate);
  } else if (timeInterval) {
    let endDate = new Date(endDateStr ? endDateStr : Date.now());

    if (!isFriday(endDate)) {
      const nextFri = nextFriday(endDate);
      if (isSameMonth(endDate, nextFri)) {
        endDate = nextFri;
      } else {
        endDate = previousFriday(endDate);
      }
    }

    switch (timeInterval) {
      case TimeIntervalEnum.LAST_WEEK:
        return getPaymentWeek(endDate, endpoint);
      case TimeIntervalEnum.LAST_2_WEEKS:
        return getPayment2Weeks(endDate, endpoint);
      case TimeIntervalEnum.LAST_MONTH:
        return getPaymentMonth(endDate, endpoint);
      default:
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
  } else {
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

  return { startDate: new Date(Date.now()), endDate: new Date(Date.now()) };
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
