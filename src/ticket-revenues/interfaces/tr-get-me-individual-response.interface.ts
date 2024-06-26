import { TicketRevenueDTO } from "../dtos/ticket-revenue.dto";

export interface ITRGetMeIndividualResponse {
  /** Card - Valor Transacao: acumulado semanal */
  amountSum: number;
  /** Card - Valor Transacao: acumulado semanal */
  paidSum: number;
  data: TicketRevenueDTO[];
}
