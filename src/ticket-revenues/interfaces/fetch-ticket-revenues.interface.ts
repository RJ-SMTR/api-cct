export interface IFetchTicketRevenues {
  cpfCnpj?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  getToday?: boolean;
  previousDays?: boolean;
}
