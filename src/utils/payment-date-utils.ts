import { HttpException, HttpStatus } from '@nestjs/common';
import { addDays, endOfDay, isFriday, isSameMonth, isThursday, nextFriday, previousFriday, startOfDay, startOfMonth, subDays } from 'date-fns';
import { isSameNthWeek } from './date-utils';
import { TimeIntervalEnum } from './enums/time-interval.enum';
import { WeekdayEnum } from './enums/weekday.enum';
import { DateIntervalType } from './types/date-interval.type';

export const PAYMENT_WEEKDAY = WeekdayEnum._5_FRIDAY;
export const PAYMENT_START_WEEKDAY = WeekdayEnum._4_THURSDAY;
export const PAYMENT_END_WEEKDAY = WeekdayEnum._3_WEDNESDAY;
export type PaymentEndpointType = 'bank-statements' | 'bank-statements/previous-days' | 'bank-statements>ticket-revenues' | 'ticket-revenues';

/**
 * From friday get starting thursday and ending wednesday
 */
export function getPaymentWeek(fridayDate: Date, endpoint: PaymentEndpointType = 'ticket-revenues'): { startDate: Date; endDate: Date } {
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
  endpoint: PaymentEndpointType; //
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

  if (startDateStr && endDateStr) {
    if (endpoint === 'ticket-revenues') {
      return {
        startDate: new Date(startDateStr),
        endDate: endOfDay(new Date(endDateStr)),
      };
    } else {
      if (endpoint === 'bank-statements/previous-days') {
        const qui = subDays(new Date(startDateStr), 1);
        const qua = subDays(endOfDay(new Date(endDateStr)), 9);
        return {
          startDate: qui,
          endDate: qua,
        };
      } else if (endpoint === 'bank-statements') {
        if (timeInterval) {
          /**
           * r = result.
           * endpoint = bank-statements, bank-statements>ticket-revenues.
           * start/end dates recebidos são início e fim do mês.
           * Deve retornar a 1a e última sexta do mês.
           */
          const r = {
            startDate: new Date(startDateStr),
            endDate: new Date(endDateStr),
          };
          return getFirstLastFridays(endpoint, r, timeInterval);
        } else {
          throw new HttpException(
            {
              errors: {
                message: 'requisição inválida - bank-statements precisa de timeInterval',
                args: { startDateStr, endDateStr, timeInterval },
              },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      } else if (endpoint === 'bank-statements>ticket-revenues') {
        if (endDateStr && endDateStr) {
          /**
           * r = rseult.
           * endpoint = bank-statements>ticket-revenues.
           * start/end dates recebidos são início e fim do mês.
           * Deve retornar a quinta da 1a semana e a quarta da última semana.
           */
          let r = {
            startDate: new Date(startDateStr),
            endDate: new Date(endDateStr),
          };
          r = getFirstLastFridays(endpoint, r, timeInterval);
          const qui = subDays(r.startDate, 8);
          const qua = subDays(r.endDate, 2);
          return {
            startDate: qui,
            endDate: qua,
          };
        } else {
          throw new HttpException(
            {
              errors: {
                details: {
                  message: 'requisição inválida - bank-statements>ticket-revenues precisa de start-date e end-date',
                  args: { startDateStr, endDateStr, timeInterval },
                },
              },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }
    }
  }
  // Apenas endDate
  else if (endDateStr && !startDateStr && !timeInterval) {
    let endDate = endOfDay(new Date(endDateStr));
    if (!isFriday(endDate)) {
      endDate = nextFriday(endDate);
    }
    return getPaymentWeek(endDate);
  } else if (timeInterval) {
    let endDate = new Date(endDateStr ? endDateStr : Date.now());
    if (!isFriday(endDate)) {
      if (isSameMonth(endDate, nextFriday(endDate))) {
        endDate = nextFriday(endDate);
      } else {
        endDate = previousFriday(endDate);
      }
    }

    if (timeInterval === TimeIntervalEnum.LAST_WEEK) {
      return getPaymentWeek(endDate, endpoint);
    } else if (timeInterval === TimeIntervalEnum.LAST_2_WEEKS) {
      return getPayment2Weeks(endDate, endpoint);
    } else if (timeInterval === TimeIntervalEnum.LAST_MONTH) {
      return getPaymentMonth(endDate, endpoint);
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

function getFirstLastFridays(
  endpoint: PaymentEndpointType, //
  interval: DateIntervalType,
  timeInterval?: TimeIntervalEnum,
) {
  const r = interval;
  // startDate: sexta atual ou a próxima sexta
  if (!isFriday(r.startDate)) {
    r.startDate = nextFriday(r.startDate);
  }
  // endDate: sexta atual ou a próxima sexta se for mesmo mês, senão, sexta anterior
  if (!isFriday(r.endDate)) {
    const isSameInterval =
      timeInterval === TimeIntervalEnum.LAST_MONTH //
        ? isSameMonth
        : (d1: Date, d2: Date) => isSameNthWeek(d1, d2, WeekdayEnum._4_THURSDAY);

    if (isSameInterval(r.endDate, nextFriday(r.endDate))) {
      r.endDate = nextFriday(r.endDate);
    } else {
      r.endDate = previousFriday(r.endDate);
    }

    r.endDate = removeFutureWeeks(r.endDate);
  }
  return r;
}

function removeFutureWeeks(endDate: Date) {
  let newEndDate = endDate;
  const today = new Date();
  /** Pega de qui-qua */
  const thisFriday = isThursday(today) ? addDays(today, 8) : nextFriday(today);
  if (newEndDate > thisFriday) {
    newEndDate = thisFriday;
  }
  return newEndDate;
}

export function validateDate(
  startDateStr?: string, //
  endDateStr?: string,
  timeInterval?: TimeIntervalEnum,
): boolean {
  const invalidCombination = startDateStr === undefined && endDateStr === undefined && timeInterval === undefined;
  if (invalidCombination) {
    return false;
  } else {
    return true;
  }
}

/**
 * @param date dia selecionado
 * @param type dataOrdem = sex-qui; dataProcTransacao = qui-qua
 */
export function nextFridayPay(date: Date, type: 'dataOrdem' | 'dataProcTransacao') {
  if (type == 'dataOrdem') {
    return nextFriday(date);
  } else {
    return isThursday(date) ? addDays(date, 8) : nextFriday(date);
  }
}
