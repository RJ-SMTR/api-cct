export interface TicketRevenuesInterface {
  id: number;
  passValidatorId: string;
  plate: string;
  dateTime: string;
  amount: number;
  lat: number;
  lon: number;
  transactions: number;
}
