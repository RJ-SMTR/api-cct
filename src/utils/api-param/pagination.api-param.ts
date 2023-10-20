import { ApiParamOptions } from '@nestjs/swagger';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const PaginationApiParams = {
  page: {
    name: 'page',
    required: false,
    description: '_Default_ : 1' + '\n\n_Min_ : 1',
  } as ApiParamOptions,
  limit: {
    name: 'limit',
    required: false,
    description: '_Default_ : 500' + '\n\n_Min_ : 1' + '\n\n_Max_ : 500',
  } as ApiParamOptions,
};
