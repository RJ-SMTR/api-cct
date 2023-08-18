import { Injectable } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { BankStatementsInterface } from './interfaces/bank-statements.interface';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { BankStatementsGetDto } from './dto/bank-statements-get.dto';
import { User } from 'src/users/entities/user.entity';
import { CoreBankService } from 'src/core-bank/core-bank.service';

@Injectable()
export class BankStatementsService {
  constructor(private readonly coreBankService: CoreBankService) {}

  public async getBankStatementsFromUser(
    user: User,
    args: BankStatementsGetDto,
  ): Promise<BankStatementsInterface[]> {
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
    const bankStatementsResponseJson =
      this.coreBankService.getBankStatementsByCpfCnpj(user.cpfCnpj);
    if (!bankStatementsResponseJson) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            cpfCnpj: 'bankStatementsRequestFailed',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const bankStatementsResponseObject = await JSON.parse(
      bankStatementsResponseJson,
    );

    const bankStatementsResponseMapped: BankStatementsInterface[] | undefined =
      bankStatementsResponseObject.data.map(
        (item) =>
          ({
            id: item.id,
            cpfCnpj: item.cpf,
            date: item.data,
            amount: item.valor,
            status: item.status,
          } as BankStatementsInterface),
      );
    if (!bankStatementsResponseMapped) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            cpfCnpj: 'bankStatementsBiProfilesFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const filteredData = bankStatementsResponseMapped.filter((item) => {
      const DEFAULT_PREVIOUS_DAYS = 30;
      const previousDays: number =
        args?.previousDays !== undefined
          ? args.previousDays
          : DEFAULT_PREVIOUS_DAYS;
      const previousDaysDate: Date | null = new Date(Date.now());
      previousDaysDate.setDate(previousDaysDate.getDate() - previousDays);
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
        item.cpfCnpj === user.cpfCnpj &&
        ((hasDateRange && isFromStart && isUntilEnd) ||
          (!hasDateRange &&
            ((hasStartOrEnd && (isFromStart || isUntilEnd)) ||
              (!hasStartOrEnd && isFromPreviousDays))))
      );
    });

    return filteredData;
  }
}
