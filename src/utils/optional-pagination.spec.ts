import { BadRequestException } from '@nestjs/common';
import {
  infinityPaginationWithTotal,
  parseOptionalPagination,
} from './optional-pagination';

describe('parseOptionalPagination', () => {
  it('should return undefined when neither page nor limit is given', () => {
    expect(parseOptionalPagination(undefined, undefined)).toBeUndefined();
  });

  it('should default page to 1 and limit to the max when only one is given', () => {
    expect(parseOptionalPagination('2', undefined)).toEqual({ page: 2, limit: 500 });
    expect(parseOptionalPagination(undefined, '50')).toEqual({ page: 1, limit: 50 });
  });

  it('should cap the limit at the max', () => {
    expect(parseOptionalPagination('1', '9999')).toEqual({ page: 1, limit: 500 });
    expect(parseOptionalPagination('1', '9999', 100)).toEqual({ page: 1, limit: 100 });
  });

  it.each([
    ['abc', '10'],
    ['1', 'x'],
    ['0', '10'],
    ['1', '0'],
    ['-1', '10'],
    ['1.5', '10'],
  ])('should reject page=%s limit=%s', (page, limit) => {
    expect(() => parseOptionalPagination(page, limit)).toThrow(BadRequestException);
  });
});

describe('infinityPaginationWithTotal', () => {
  it('should report the next page from the total of the filtered set', () => {
    expect(infinityPaginationWithTotal([1, 2], 5, { page: 1, limit: 2 })).toEqual({
      count: 2,
      total: 5,
      hasNextPage: true,
      data: [1, 2],
    });
    expect(infinityPaginationWithTotal([5], 5, { page: 3, limit: 2 }).hasNextPage).toBe(false);
  });

  it('should not report a next page when the last page is exactly full', () => {
    expect(infinityPaginationWithTotal([3, 4], 4, { page: 2, limit: 2 }).hasNextPage).toBe(false);
  });

  it('should treat a request without pagination as a single complete page', () => {
    expect(infinityPaginationWithTotal([1, 2, 3], 3, undefined)).toEqual({
      count: 3,
      total: 3,
      hasNextPage: false,
      data: [1, 2, 3],
    });
  });
});
