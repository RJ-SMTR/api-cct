import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { getStartEndDates } from 'src/utils/date-utils';
import { nextPaymentWeekday } from 'src/utils/payment-date-utils';
import { IBankStatementsGet } from './interfaces/bank-statements-get.interface';
import { IBankStatementsResponse } from './interfaces/bank-statements-response.interface';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class BankStatementsService {
  constructor(
    private readonly coreBankService: CoreBankService,
    private readonly usersService: UsersService,
  ) {}

  public async getBankStatementsFromUser(
    args: IBankStatementsGet,
  ): Promise<IBankStatementsResponse> {
    if (isNaN(args?.userId as number)) {
      throw new HttpException(
        {
          details: {
            userId: `field is ${args?.userId}`,
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    // For now it validates if user exists
    await this.usersService.getOne({ id: args?.userId });

    // TODO: fetch instead of mockup
    const bankStatementsResponse =
      this.coreBankService.getBankStatementsMocked();

    const endDateStr =
      args?.endDate ||
      nextPaymentWeekday(new Date(Date.now())).toISOString().slice(0, 10);
    const { startDate, endDate } = getStartEndDates({
      startDateStr: args?.startDate,
      endDateStr: endDateStr,
      timeInterval: args?.timeInterval,
    });

    const filteredData = bankStatementsResponse.filter((item) => {
      const itemDate: Date = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });

    const amountSum = filteredData.reduce((sum, item) => sum + item.amount, 0);

    return {
      data: filteredData,
      amountSum,
    };
  }
}
