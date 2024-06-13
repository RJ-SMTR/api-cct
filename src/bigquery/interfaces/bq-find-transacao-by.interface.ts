export interface IBqFindTransacao {
  cpfCnpj?: string;
  manyCpfCnpj?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  getToday?: boolean;
  previousDaysOnly?: boolean;
}
