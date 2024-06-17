import { TicketRevenuesGroupDto } from '../dtos/ticket-revenues-group.dto';

export interface ITRGetMeGroupedResponse {
  startDate: string | null;
  endDate: string | null;
  /** Card - Valor Transacao: acumulado semanal */
  amountSum: number;
  /** Card - Valor Transacao: acumulado semanal */
  paidSum: number;
  todaySum: number;
  ticketCount: number;
  count: number;
  data: TicketRevenuesGroupDto[];
}
