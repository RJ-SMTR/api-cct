import { ITicketRevenuesGroup } from './ticket-revenues-group.interface';

export interface ITRGetMeGroupedResponse {
  startDate: string | null;
  endDate: string | null;
  amountSum: number;
  paidSum: number;
  todaySum: number;
  ticketCount: number;
  count: number;
  data: ITicketRevenuesGroup[];
}
