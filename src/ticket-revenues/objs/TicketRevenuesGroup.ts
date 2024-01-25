import { ITicketRevenuesGroup } from '../interfaces/ticket-revenues-group.interface';
import { ITRCounts } from '../interfaces/tr-count-content.interface';

export class TicketRevenuesGroup implements ITicketRevenuesGroup {
  public aux_epochWeek = 0;
  public aux_groupDateTime = '';
  public count = 0;
  public directionIdCounts: Record<string, ITRCounts> = {};
  public partitionDate = '';
  public paymentMediaTypeCounts: Record<string, ITRCounts> = {};
  public permitCode = '';
  public stopIdCounts: Record<number, ITRCounts> = {};
  public stopLatCounts: Record<number, ITRCounts> = {};
  public stopLonCounts: Record<number, ITRCounts> = {};
  public transactionTypeCounts: Record<string, ITRCounts> = {};
  public transactionValueSum = 0;
  public transportIntegrationTypeCounts: Record<string, ITRCounts> = {};
  public transportTypeCounts: Record<string, ITRCounts> = {};

  public toInterface(): ITicketRevenuesGroup {
    return {
      aux_epochWeek: this.aux_epochWeek,
      aux_groupDateTime: this.aux_groupDateTime,
      count: this.count,
      directionIdCounts: this.directionIdCounts,
      partitionDate: this.partitionDate,
      paymentMediaTypeCounts: this.paymentMediaTypeCounts,
      stopIdCounts: this.stopIdCounts,
      stopLatCounts: this.stopLatCounts,
      stopLonCounts: this.stopLonCounts,
      transactionTypeCounts: this.transactionTypeCounts,
      transactionValueSum: this.transactionValueSum,
      transportIntegrationTypeCounts: this.transportIntegrationTypeCounts,
      transportTypeCounts: this.transportTypeCounts,
    };
  }
}
