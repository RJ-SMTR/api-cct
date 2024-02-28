export interface IBqFetchTransacao {
  cpfCnpj?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  getToday?: boolean;
  previousDaysOnly?: boolean;
}
