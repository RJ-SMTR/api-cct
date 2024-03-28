import { ApiParamOptions } from '@nestjs/swagger';
import { DescriptionApiParam } from './description-api-param';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const PaginationApiParams = {
  page: {
    name: 'page',
    required: false,
    description: DescriptionApiParam({ default: 1, min: 1 }),
  } as ApiParamOptions,

  limit: {
    name: 'limit',
    required: false,
    description: DescriptionApiParam({ default: 500, min: 1, max: 500 }),
  } as ApiParamOptions,
  getLimit: (args: any = { default: 500, min: 1, max: 500 }) =>
    ({
      name: 'limit',
      required: false,
      description: DescriptionApiParam(args),
    } as ApiParamOptions),
};
