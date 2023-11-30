import { ITicketRevenuesGroup } from './ticket-revenues-group.interface';

export interface ITicketRevenuesGroupedResponse {
  startDate: string | null;
  endDate: string | null;
  amountSum: number;
  todaySum: number;
  ticketCount: number;
  count: number;
  data: ITicketRevenuesGroup[];
}
