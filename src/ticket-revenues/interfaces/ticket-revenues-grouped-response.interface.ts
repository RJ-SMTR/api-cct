import { ITicketRevenuesGroup } from './ticket-revenues-group.interface';

export interface ITicketRevenuesGroupedResponse {
  data: ITicketRevenuesGroup[];
  transactionValueLastDay: number;
}
