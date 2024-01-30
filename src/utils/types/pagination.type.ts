export type Pagination<T> = Readonly<
  {
    count: number;
    nextPage: number | null;
    previousPage: number | null;
  } & T
>;
