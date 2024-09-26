import { Exception } from 'handlebars';
import { DateMonth } from './date-month.type';

export type HumanMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export function isHumanMonth(n: number): n is HumanMonth {
  if (n < 1 || n > 12) {
    return false;
  }
  return true;
}

export function numberToHumanMonth(n: number): HumanMonth {
  if (isHumanMonth(n)) {
    return n;
  } else {
    throw new Exception(`Value ${n} is not a valid HumanMonth. It must be a number betweeb 1-12.`);
  }
}

export function dateMonthToHumanMonth(n: DateMonth): HumanMonth {
  return (n + 1) as HumanMonth;
}
