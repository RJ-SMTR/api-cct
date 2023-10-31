export type InfinityPaginationResultType<T> = Readonly<{
  count: number;
  hasNextPage: boolean;
  data: T[];
}>;
