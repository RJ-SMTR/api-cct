import { IPaginationOptions } from './types/pagination-options';
import { PaginationResultType } from './types/pagination-result.type';

export const pagination = <T>(
  result: T,
  count: number,
  max: number,
  options: IPaginationOptions,
): PaginationResultType<T> => {
  return {
    count,
    nextPage: options.page * max < count ? options.page + 1 : null,
    previousPage: options.page > 1 ? options.page - 1 : null,
    ...result,
  };
};
