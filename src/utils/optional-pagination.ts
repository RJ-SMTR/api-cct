import { BadRequestException } from '@nestjs/common';
import { InfinityPaginationResultType } from './types/infinity-pagination-result.type';
import { PaginationOptions } from './types/pagination-options';

export const DEFAULT_MAX_PAGINATION_LIMIT = 500;

export type InfinityPaginationWithTotalResultType<T> =
  InfinityPaginationResultType<T> & Readonly<{ total: number }>;

function parsePositiveInt(name: string, value: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new BadRequestException(`'${name}' must be a positive integer`);
  }
  return Number(value);
}

/**
 * Pagination for endpoints whose clients may still expect the full list.
 * Without `page` and `limit` it returns `undefined` (no pagination); with either
 * one, the other gets its default (page 1, limit = max) and the limit is capped.
 */
export function parseOptionalPagination(
  page?: string,
  limit?: string,
  maxLimit = DEFAULT_MAX_PAGINATION_LIMIT,
): PaginationOptions | undefined {
  if (page === undefined && limit === undefined) {
    return undefined;
  }
  return {
    page: page === undefined ? 1 : parsePositiveInt('page', page),
    limit: Math.min(
      limit === undefined ? maxLimit : parsePositiveInt('limit', limit),
      maxLimit,
    ),
  };
}

/** Like `infinityPagination`, but `hasNextPage` comes from the total of the filtered set. */
export function infinityPaginationWithTotal<T>(
  data: T[],
  total: number,
  options?: PaginationOptions,
): InfinityPaginationWithTotalResultType<T> {
  const hasNextPage = options
    ? (options.page - 1) * options.limit + data.length < total
    : false;
  return { count: data.length, total, hasNextPage, data };
}
