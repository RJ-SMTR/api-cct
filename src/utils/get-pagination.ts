import { IPaginationOptions } from './types/pagination-options';
import { Pagination } from './types/pagination.type';

export const getPagination = <T>(
  result: T,
  args: {
    dataLenght: number;
    maxCount: number;
  },
  options: IPaginationOptions,
): Pagination<T> => {
  const { dataLenght, maxCount } = args;
  return {
    count: maxCount,
    nextPage: options.page * dataLenght < maxCount ? options.page + 1 : null,
    previousPage: options.page > 1 ? options.page - 1 : null,
    ...result,
  };
};
