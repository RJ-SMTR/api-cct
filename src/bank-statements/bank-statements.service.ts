import { Injectable } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { User } from 'src/users/entities/user.entity';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { IBankStatementsResponse } from './interfaces/bank-statements-response.interface';
import { IBankStatementsGet } from './interfaces/bank-statements-get.interface';
import { getStartEndDates } from 'src/utils/date-utils';
import { nextPaymentWeekday } from 'src/utils/payment-date-utils';

@Injectable()
export class BankStatementsService {
  constructor(private readonly coreBankService: CoreBankService) {}

  public getBankStatementsFromUser(
    user: User,
    args: IBankStatementsGet,
  ): IBankStatementsResponse {
    if (!user.cpfCnpj) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            user: {
              cpfCnpj: 'fieldIsEmpty',
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // TODO: fetch instead of mockup
    // TODO: get by user.cpfCnpj
    const bankStatementsResponse =
      this.coreBankService.getBankStatementsMocked();
    if (bankStatementsResponse.length === 0) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            cpfCnpj: 'empty bankStatements for profile',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

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

    // const amountLastDay = filteredData.length > 0
    //   ? filteredData[0].

    return {
      data: filteredData,
      amountSum,
    };
  }
}
