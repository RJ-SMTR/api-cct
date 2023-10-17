import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { TicketRevenuesGetDto } from './dto/ticket-revenues-get.dto';
import { JaeService } from 'src/jae/jae.service';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { JaeTicketRevenueInterface } from 'src/jae/interfaces/jae-ticket-revenue.interface';
import { IPaginationOptions } from 'src/utils/types/pagination-options';

@Injectable()
export class TicketRevenuesService {
  constructor(private readonly jaeService: JaeService) {}

  public async getDataFromUser(
    user: User,
    args: TicketRevenuesGetDto,
    pagination: IPaginationOptions,
  ): Promise<JaeTicketRevenueInterface[]> {
    if (!user.permitCode) {
      throw new HttpException(
        {
          details: {
            message: 'maybe your token has expired, try to get a new one',
            user: {
              permitCode: 'fieldIsEmpty',
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // TODO: fetch instead of mockup

    // TODO: get by user.permitCode
    const ticketRevenuesResponse =
      await this.jaeService.getTicketRevenuesMocked(pagination);
    if (ticketRevenuesResponse.length === 0) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            permitCode: 'fetchResultNotFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const filteredData = ticketRevenuesResponse.filter((item) => {
      const DEFAULT_PREVIOUS_DAYS = 30;
      let previousDays: number = DEFAULT_PREVIOUS_DAYS;
      if (args?.previousDays !== undefined) {
        previousDays = args.previousDays;
      }
      const previousDaysDate: Date = new Date(Date.now());
      previousDaysDate.setUTCDate(previousDaysDate.getUTCDate() - previousDays);
      previousDaysDate.setUTCHours(0, 0, 0, 0);

      const todayDate = new Date(Date.now());
      const itemDate: Date = new Date(item.transactionDateTime);
      const startDate: Date | null = args?.startDate
        ? new Date(args.startDate)
        : null;
      const endDate: Date | null = args?.endDate
        ? new Date(args.endDate)
        : null;
      if (endDate !== null) {
        endDate.setUTCHours(23, 59, 59, 999);
      }

      const hasDateRange = Boolean(args?.startDate && args?.endDate);
      const hasStartOrEnd = Boolean(args?.startDate || args?.endDate);
      const isFromStart = startDate && itemDate >= startDate;
      const isUntilEnd = endDate && itemDate <= endDate;
      const isFromPreviousDays =
        previousDaysDate &&
        itemDate >= previousDaysDate &&
        itemDate <= todayDate;

      return (
        (hasDateRange && isFromStart && isUntilEnd) ||
        (!hasDateRange &&
          ((hasStartOrEnd && (isFromStart || isUntilEnd)) ||
            (!hasStartOrEnd && isFromPreviousDays)))
      );
    });

    return filteredData;
  }
}
