import { Exception } from 'handlebars';
import { HumanMonth } from './human-month.type';

export type DateMonth = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export function isDateMonth(n: number): n is DateMonth {
  if (n < 0 || n > 11) {
    return false;
  }
  return true;
}

export function numberToDateMonth(n: number): DateMonth {
  if (isDateMonth(n)) {
    return n;
  } else {
    throw new Exception(`Value ${n} is not a valid DateMonth. It must be a number betweeb 0-11.`);
  }
}

export function humanMonthToDateMonth(n: HumanMonth): DateMonth {
  return (n - 1) as DateMonth;
}
