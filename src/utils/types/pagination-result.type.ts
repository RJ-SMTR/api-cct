export type PaginationResultType<T> = Readonly<
  {
    count: number;
    nextPage: number | null;
    previousPage: number | null;
  } & T
>;
