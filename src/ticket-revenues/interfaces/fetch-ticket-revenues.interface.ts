export interface IFetchTicketRevenues {
  permitCode?: string | 'mock';
  startDate?: string;
  endDate?: string;
  previousDays?: number;
  limit?: number;
  offset?: number;
}
