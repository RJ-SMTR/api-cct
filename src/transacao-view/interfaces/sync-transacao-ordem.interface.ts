export interface ISyncOrdemPgto {
  /** [startDate, endDate] */
  dataOrdem_between?: [Date, Date];
  consorcio?: { in?: string[]; notIn?: string[] };
  nomeFavorecido?: string[];
}

export interface IClearSyncOrdemPgto {
  /** [startDate, endDate] */
  dataOrdem_between?: [Date, Date];
  consorcio?: string[];
  nomeFavorecido?: string[];
}
