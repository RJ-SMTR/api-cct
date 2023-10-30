import { TimeIntervalEnum } from '../enums/time-interval.enum';
import { DefaultValuePipe } from '@nestjs/common';
import { QueryParamsType } from '../types/query-params.type';
import { ParseDatePipe } from '../pipes/parse-date.pipe';

/**
 * @type `Record<string, QueryParamsType>`
 */
export const DateQueryParams = {
  startDate: [
    'startDate',
    new ParseDatePipe(/^\d{4}-\d{2}-\d{2}$/),
  ] as QueryParamsType,

  endDate: [
    'endDate',
    new ParseDatePipe(/^\d{4}-\d{2}-\d{2}$/),
  ] as QueryParamsType,

  timeInterval: [
    'timeInterval',
    new DefaultValuePipe(TimeIntervalEnum.LAST_MONTH),
  ] as QueryParamsType,
};
