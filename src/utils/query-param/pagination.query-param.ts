import { DefaultValuePipe } from '@nestjs/common';
import { ParseNumberPipe } from '../pipes/parse-number.pipe';
import { QueryParamsType } from '../types/query-params.type';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const PaginationQueryParams = {
  /** default: 1, min: 1 */
  page: [
    'page',
    new DefaultValuePipe(1),
    new ParseNumberPipe({ min: 1 }),
  ] as QueryParamsType,

  /** default: 500, min: 1, max: 500 */
  limit: [
    'limit',
    new DefaultValuePipe(500),
    new ParseNumberPipe({ min: 1, max: 500 }),
  ] as QueryParamsType,
};
