import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { lastDayOfMonth, nextFriday } from 'date-fns';
import { Enum } from 'src/utils/enum';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import { CoreBankStatusCodeEnum } from '../enums/core-bank-status-code.enum';
import { CoreBankStatusEnum } from '../enums/core-bank-status.enum';
import { ICoreBankProfile } from '../interfaces/core-bank-profile.interface';
import { ICoreBankStatements } from '../interfaces/core-bank-statements.interface';
import { formatLog } from 'src/utils/log-utils';

@Injectable()
export class CoreBankDataService implements OnModuleInit {
  private logger: Logger = new Logger('CoreBankDataService', {
    timestamp: true,
  });
  private bankStatements: ICoreBankStatements[] = [];
  public bankStatementsArgs: any = {
    weeks: 4 * 3,
    maxValue: 1500,
    minValue: 50,
    paymentWeekday: WeekdayEnum._5_FRIDAY,
    nextPaymentWeekday: (date: Date) => nextFriday(date),
  };

  private profiles: ICoreBankProfile[] = [
    {
      // Henrique
      id: 1,
      permitCode: '213890329890312',
      cpfCnpj: 'cpf1',
      bankCode: 1,
      bankAgencyCode: '2234',
      bankAgencyDigit: '9',
      bankAccountCode: '58339',
      bankAccountDigit: '9',
      rg: '04034484000140',
      bankAgencyName: 'RIO DE JANEIRO (CAP)',
    },
    {
      // Outro usuário
      id: 2,
      permitCode: '319274392832023',
      cpfCnpj: 'cpf2',
      bankCode: 10,
      bankAgencyCode: '72',
      bankAgencyDigit: '8',
      bankAccountCode: '205005',
      bankAccountDigit: '6',
      rg: '28521748000159',
      bankAgencyName: 'NITEROI',
    },
  ];

  onModuleInit() {
    this.logger.log('onModuleInit(): Inicializando dados simulados.');
    this.updateDataIfNeeded();
  }

  private generateRandomNumber(
    min: number,
    max: number,
    likelyNumber: number,
    probability: number,
  ): number {
    const randomProbability = Math.random();
    if (randomProbability <= probability) {
      return likelyNumber;
    }
    const randomValue = Math.random() * (max - min) + min;
    return randomValue;
  }

  private generateBankStatement(args: {
    id: number;
    nthWeek: number;
    weekday: number;
    permitCode: string;
    cpfCnpj: string;
    status?: CoreBankStatusEnum;
  }): ICoreBankStatements {
    const { id, permitCode, nthWeek, weekday, cpfCnpj, status } = args;
    const date = new Date(Date.now());
    date.setUTCDate(date.getUTCDate() - 7 * nthWeek);
    while (date.getUTCDay() !== weekday) {
      date.setUTCDate(date.getUTCDate() - 1);
    }

    const { maxValue, minValue } = this.bankStatementsArgs;
    const statusObj = Object.keys(CoreBankStatusEnum);
    const randomStatusNumber = Math.floor(
      this.generateRandomNumber(1, 2, 1, 0.8),
    );
    const randomStatus = statusObj
      .slice(statusObj.length / 2, statusObj.length)
      [randomStatusNumber].toString()
      .toLowerCase();
    const statusCodeObj = Object.keys(CoreBankStatusCodeEnum);
    const randomStatusCodeNumber = Math.floor(
      this.generateRandomNumber(0, 3, 0, 0.8),
    );
    const randomStatusCode = statusCodeObj
      .slice(statusCodeObj.length / 2, statusCodeObj.length)
      [randomStatusCodeNumber].toString()
      .toLowerCase();
    const randomInt = Math.floor(
      Math.random() * (maxValue - minValue + 1) + minValue,
    );
    const randomDecimal = Math.floor(Math.random() * (99 - 0 + 1) + 0) / 100;
    const yearString = date.getUTCFullYear().toString();
    const monthString = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const dayString = date.getUTCDate().toString().padStart(2, '0');
    return {
      id: id,
      permitCode,
      cpfCnpj,
      date: `${yearString}-${monthString}-${dayString}`,
      amount: randomInt + randomDecimal,
      status:
        status !== undefined
          ? Enum.getKey(CoreBankStatusEnum, status).toLowerCase()
          : randomStatus,
      statusCode: randomStatusCode,
    };
  }

  /**
   * Every statement consider revenues from thursday to wednesday,
   * and the statement is send in the next day: friday.
   */
  private setBankStatements() {
    const bankStatements: ICoreBankStatements[] = [];
    const now = new Date(Date.now());
    const { paymentWeekday, nextPaymentWeekday } = this.bankStatementsArgs;
    for (const profile of this.getProfiles()) {
      let id = 1;
      if (nextPaymentWeekday(now) <= lastDayOfMonth(now)) {
        bankStatements.push(
          this.generateBankStatement({
            id: id,
            nthWeek: -1,
            weekday: paymentWeekday,
            permitCode: profile.permitCode,
            cpfCnpj: profile.cpfCnpj,
            status: CoreBankStatusEnum.accumulated,
          }),
        );
        id++;
      }
      for (let week = 0; week < this.bankStatementsArgs.weeks; week++) {
        bankStatements.push(
          this.generateBankStatement({
            id: week + id,
            nthWeek: week,
            weekday: paymentWeekday,
            permitCode: profile.permitCode,
            cpfCnpj: profile.cpfCnpj,
          }),
        );
      }
    }
    this.logger.log(
      'setBankStatements(): Dados simulados gerados com sucesso.',
    );
    this.bankStatements = bankStatements;
  }

  public updateDataIfNeeded() {
    if (this.bankStatements.length === 0) {
      this.setBankStatements();
      this.logger.debug(
        'updateDataIfNeeded(): Gerando dados simulados, pois bankStatements está vazio',
      );
    } else {
      const lastDate = new Date(this.bankStatements?.[0]?.date);
      const hoursDifference =
        (new Date(Date.now()).getTime() - lastDate.getTime()) /
        (1000 * 60 * 60);
      if (hoursDifference >= 24 * 7) {
        this.logger.debug(
          formatLog(
            `Gerando dados simulados, pois se passou pelo menos ${hoursDifference} h`,
            'updateDataIfNeeded()',
          ),
        );
        this.setBankStatements();
      }
    }
  }

  public getBankStatements(): ICoreBankStatements[] {
    this.updateDataIfNeeded();
    return this.bankStatements;
  }

  public getProfiles(): ICoreBankProfile[] {
    return this.profiles;
  }
}
