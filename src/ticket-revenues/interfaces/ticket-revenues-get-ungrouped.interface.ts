export interface ITicketRevenuesGetUngrouped {
  startDate?: string;
  endDate?: string;
  previousDays?: number;
  startWeekday: number;
  ignorePreviousWeek: boolean;
}
