import { TicketRevenuesGroupByEnum } from '../enums/ticket-revenues-group-by.enum';

export interface ITicketRevenuesGet {
  startDate?: string;
  endDate?: string;
  previousDays?: number;
  startWeekday: number;
  ignorePreviousWeek: boolean;
  groupBy: TicketRevenuesGroupByEnum;
}
