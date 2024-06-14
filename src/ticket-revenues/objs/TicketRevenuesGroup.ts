import { TicketRevenuesGroupDto } from '../dtos/ticket-revenues-group.dto';
import { ITRCounts } from '../interfaces/tr-counts.interface';

export class TicketRevenuesGroup implements TicketRevenuesGroupDto {
  public aux_epochWeek = 0;
  public aux_nthWeeks = [];
  public aux_groupDateTime = '';
  public count = 0;
  public directionIdCounts: Record<string, ITRCounts> = {};
  public date = '';
  public paymentMediaTypeCounts: Record<string, ITRCounts> = {};
  public permitCode = '';
  public stopIdCounts: Record<number, ITRCounts> = {};
  public stopLatCounts: Record<number, ITRCounts> = {};
  public stopLonCounts: Record<number, ITRCounts> = {};
  public transactionTypeCounts: Record<string, ITRCounts> = {};
  public transactionValueSum = 0;
  public paidValueSum = 0;
  public transportIntegrationTypeCounts: Record<string, ITRCounts> = {};
  public transportTypeCounts: Record<string, ITRCounts> = {};
  public isPago = false;
  public errors: string[] = [];

  public toInterface(): TicketRevenuesGroupDto {
    return {
      aux_epochWeek: this.aux_epochWeek,
      aux_nthWeeks: this.aux_nthWeeks,
      aux_groupDateTime: this.aux_groupDateTime,
      count: this.count,
      directionIdCounts: this.directionIdCounts,
      date: this.date,
      paymentMediaTypeCounts: this.paymentMediaTypeCounts,
      stopIdCounts: this.stopIdCounts,
      stopLatCounts: this.stopLatCounts,
      stopLonCounts: this.stopLonCounts,
      transactionTypeCounts: this.transactionTypeCounts,
      transactionValueSum: this.transactionValueSum,
      paidValueSum: this.paidValueSum,
      transportIntegrationTypeCounts: this.transportIntegrationTypeCounts,
      transportTypeCounts: this.transportTypeCounts,
      isPago: this.isPago,
      errors: this.errors,
    };
  }
}
