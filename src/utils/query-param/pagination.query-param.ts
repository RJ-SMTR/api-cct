import { DefaultValuePipe } from '@nestjs/common';
import { ParseNumberPipe } from '../pipes/parse-number.pipe';
import { QueryParamsType } from '../types/query-params.type';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const PaginationQueryParams = {
  page: [
    'page',
    new DefaultValuePipe(1),
    new ParseNumberPipe({ min: 1 }),
  ] as QueryParamsType,

  limit: [
    'limit',
    new DefaultValuePipe(500),
    new ParseNumberPipe({ max: 500 }),
  ] as QueryParamsType,
};
