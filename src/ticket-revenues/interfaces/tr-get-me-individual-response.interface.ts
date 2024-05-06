import { ITicketRevenue } from './ticket-revenue.interface';

export interface ITRGetMeIndividualResponse {
  amountSum: number;
  data: ITicketRevenue[];
}
