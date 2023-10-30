import { ITicketRevenue } from './ticket-revenue.interface';
import { ITicketRevenuesGroup } from './ticket-revenues-group.interface';

export interface ITicketRevenuesUngroupedResponse {
  data: ITicketRevenue[];
  ticketRevenuesSumGroup: ITicketRevenuesGroup | null;
  lastDayTransactionValue: number;
}
