import { PaginationOptions } from './types/pagination-options';
import { InfinityPaginationResultType } from './types/infinity-pagination-result.type';

export const infinityPagination = <T>(
  data: T[],
  options: PaginationOptions,
): InfinityPaginationResultType<T> => {
  return {
    count: data.length,
    hasNextPage: data.length === options.limit,
    data,
  };
};
