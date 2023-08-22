import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { TicketRevenuesGetDto } from './dto/ticket-revenues-get.dto';
import { JaeService } from 'src/jae/jae.service';
import { TicketRevenuesInterface } from './interface/ticket-revenue.interface';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';

@Injectable()
export class TicketRevenuesService {
  constructor(private readonly jaeService: JaeService) {}

  public async getDataFromUser(
    user: User,
    args: TicketRevenuesGetDto,
  ): Promise<TicketRevenuesInterface[]> {
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
    const ticketRevenuesResponseObject = await JSON.parse(
      await this.jaeService.getTicketRevenuesByValidator(user.passValidatorId),
    ).data;

    const ticketRevenuesResponse: TicketRevenuesInterface[] | undefined =
      ticketRevenuesResponseObject.map(
        (item) =>
          ({
            id: item.codigo,
            passValidatorId: item.validador,
            plate: item.placa,
            dateTime: item.dataHora,
            amount: item.valor,
            lat: item.latitude,
            lon: item.longitude,
            transactions: item.transacoes,
          } as TicketRevenuesInterface),
      );
    if (!ticketRevenuesResponse) {
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
