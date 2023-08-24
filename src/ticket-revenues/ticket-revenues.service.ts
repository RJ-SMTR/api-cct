import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { TicketRevenuesGetDto } from './dto/ticket-revenues-get.dto';
import { JaeService } from 'src/jae/jae.service';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { JaeTicketRevenueInterface } from 'src/jae/interfaces/jae-ticket-revenue.interface';

@Injectable()
export class TicketRevenuesService {
  constructor(private readonly jaeService: JaeService) {}

  public async getDataFromUser(
    user: User,
    args: TicketRevenuesGetDto,
  ): Promise<JaeTicketRevenueInterface[]> {
    if (!user.permitCode || !user.passValidatorId) {
      throw new HttpException(
        {
          details: {
            user: {
              ...(!user.permitCode && { permitCode: 'fieldIsEmpty' }),
              ...(!user.passValidatorId && { passValidatorId: 'fieldIsEmpty' }),
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // TODO: fetch instead of mockup

    const ticketRevenuesResponse =
      await this.jaeService.getTicketRevenuesByValidator(user.passValidatorId);
    if (ticketRevenuesResponse.length === 0) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            permitCode: 'ticketRevenuesNotFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const filteredData = ticketRevenuesResponse.filter((item) => {
      const DEFAULT_PREVIOUS_DAYS = 30;
      const previousDays: number =
        args?.previousDays !== undefined
          ? args.previousDays
          : DEFAULT_PREVIOUS_DAYS;
      const previousDaysDate: Date | null = new Date();
      previousDaysDate.setUTCDate(previousDaysDate.getDate() - previousDays);
      previousDaysDate.setUTCHours(0, 0, 0, 0);

      const todayDate = new Date();
      const itemDate: Date = new Date(item.dateTime);
      const startDate: Date | null = args?.startDate
        ? new Date(args.startDate)
        : null;
      const endDate: Date | null = args?.endDate
        ? new Date(args.endDate)
        : null;

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
