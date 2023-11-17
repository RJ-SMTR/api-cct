import { ITicketRevenuesGroup } from './ticket-revenues-group.interface';

export interface ITicketRevenuesGroupedResponse {
  amountSum: number;
  todaySum: number;
  count: number;
  ticketCount: number;
  data: ITicketRevenuesGroup[];
}
