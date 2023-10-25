import { DefaultValuePipe } from '@nestjs/common';
import { MinMaxNumberPipe } from '../pipes/min-max-number.pipe';
import { QueryParamsType } from '../types/query-params.type';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const PaginationQueryParams = {
  page: [
    'page',
    new DefaultValuePipe(1),
    new MinMaxNumberPipe({ min: 1 }),
  ] as QueryParamsType,

  limit: [
    'limit',
    new DefaultValuePipe(500),
    new MinMaxNumberPipe({ max: 500 }),
  ] as QueryParamsType,
};
