import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { TripsIncomeGetDto } from './dto/trips-income-get.dto';
import { TripsIncomeInterface } from './interfaces/trips-income.interface';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { tripsIncomeResponseMockup } from './data/trips-income-response-mockup';

@Injectable()
export class TripsIncomeService {
  public async getFromUser(
    user: User,
    args: TripsIncomeGetDto,
  ): Promise<TripsIncomeInterface[]> {
    if (!user.permitCode) {
      throw new HttpException(
        {
          details: {
            user: {
              permitCode: 'fieldIsEmpty',
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // TODO: fetch instead of mockup
    const tripsIncomeResponseObject = await JSON.parse(
      tripsIncomeResponseMockup,
    );

    const userTripsIncome =
      tripsIncomeResponseObject.permissionario?.[user.permitCode];
    if (!userTripsIncome) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            permitCode: 'tripsIncomeProfileNotFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const tripsIncomeResponse: TripsIncomeInterface[] | undefined =
      userTripsIncome.rows.map(
        (item) =>
          ({
            id: item.id,
            permitCode: item.permissionario,
            date: item.data,
            netAmount: item.valorLiquido,
          } as TripsIncomeInterface),
      );
    if (!tripsIncomeResponse) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            permitCode: 'tripsIncomeBiProfilesFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const filteredData = tripsIncomeResponse.filter((item) => {
      const DEFAULT_PREVIOUS_DAYS = 30;
      const previousDays: number =
        args?.previousDays !== undefined
          ? args.previousDays
          : DEFAULT_PREVIOUS_DAYS;
      const previousDaysDate: Date | null = new Date();
      previousDaysDate.setUTCDate(previousDaysDate.getDate() - previousDays);
      previousDaysDate.setUTCHours(0, 0, 0, 0);

      const todayDate = new Date();
      const itemDate: Date = new Date(item.date);
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
        item.permitCode === user.permitCode &&
        ((hasDateRange && isFromStart && isUntilEnd) ||
          (!hasDateRange &&
            ((hasStartOrEnd && (isFromStart || isUntilEnd)) ||
              (!hasStartOrEnd && isFromPreviousDays))))
      );
    });

    return filteredData;
  }
}
