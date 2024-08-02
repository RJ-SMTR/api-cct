import { SetValueIf } from 'src/utils/decorators/set-value-if.decorator';
import { TicketRevenuesGroupDto } from '../dtos/ticket-revenues-group.dto';
import { DeepPartial } from 'typeorm';

export class TRGetMeGroupedResponseDto {
  constructor(data?: TRGetMeGroupedResponseDto) {
    if (data) {
      Object.assign(this, data);
    }
  }

  startDate: string | null;
  endDate: string | null;
  /** Card - Valor Transacao: acumulado semanal */
  amountSum: number;
  /** Card - Valor Transacao: acumulado semanal */
  @SetValueIf(
    (o: TRGetMeGroupedResponseDto) =>
      !o.data.every((i) => i.isPago || i.getIsEmpty()),
    0,
  )
  paidSum: number;
  todaySum: number;
  ticketCount: number;
  count: number;
  data: TicketRevenuesGroupDto[];
}
