import { TicketRevenuesGroupDto } from '../dtos/ticket-revenues-group.dto';

export interface ITRGetMeGroupedResponse {
  startDate: string | null;
  endDate: string | null;
  amountSum: number;
  paidSum: number;
  todaySum: number;
  ticketCount: number;
  count: number;
  data: TicketRevenuesGroupDto[];
}
