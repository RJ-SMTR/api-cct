import { ITicketRevenuesGroup } from '../interfaces/ticket-revenues-group.interface';

export class TicketRevenuesGroup implements ITicketRevenuesGroup {
  public aux_epochWeek = 0;
  public aux_groupDateTime = '';
  public count = 0;
  public directionIdCounts: Record<string, number> = {};
  public partitionDate = '';
  public paymentMediaTypeCounts: Record<string, number> = {};
  public permitCode = '';
  public stopIdCounts: Record<number, number> = {};
  public stopLatCounts: Record<number, number> = {};
  public stopLonCounts: Record<number, number> = {};
  public transactionTypeCounts: Record<string, number> = {};
  public transactionValueSum = 0;
  public transportIntegrationTypeCounts: Record<string, number> = {};
  public transportTypeCounts: Record<string, number> = {};
}
