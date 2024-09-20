export interface ISyncOrdemPgto {
  /** [startDate, endDate] */
  dataOrdem_between?: [Date, Date];
  consorcio?:string[];
  nomeFavorecido?: string[];
}