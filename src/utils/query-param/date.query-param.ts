import { DefaultValuePipe } from '@nestjs/common';
import { TimeIntervalEnum } from '../enums/time-interval.enum';
import { ParseDatePipe } from '../pipes/parse-date.pipe';
import { QueryParamsType } from '../types/query-params.type';
import { ParseYearMonthPipe } from '../pipes/parse-year-month.pipe';

/**
 * @type `Record<string, QueryParamsType>`
 */
export const DateQueryParams = {
  yearMonth: ['yearMonth', new ParseYearMonthPipe()] as QueryParamsType,

  startDate: ['startDate', new ParseDatePipe({ optional: true })] as QueryParamsType,

  endDate: ['endDate', new ParseDatePipe({ optional: true })] as QueryParamsType,

  getDate: (name: string, mandatory = false) =>
    [name, new ParseDatePipe({ optional: mandatory })] as QueryParamsType,

  timeInterval: [
    'timeInterval',
    new DefaultValuePipe(TimeIntervalEnum.LAST_MONTH),
  ] as QueryParamsType,
};
