import { ApiParamOptions } from '@nestjs/swagger';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const PaginationApiParams = {
  page: {
    name: 'page',
    required: false,
    description: '**default:** 1, **min:** 1',
  } as ApiParamOptions,
  limit: {
    name: 'limit',
    required: false,
    description: '**default:** 500, **min:** 1, **max:** 500',
  } as ApiParamOptions,
};
