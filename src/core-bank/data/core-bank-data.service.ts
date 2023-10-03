import { Injectable } from '@nestjs/common';
import { CoreBankStatementsInterface } from '../interfaces/core-bank-statements.interface';
import { CoreBankProfileInterface } from '../interfaces/core-bank-profile.interface';

@Injectable()
export class CoreBankDataService {
  private bankStatements: CoreBankStatementsInterface[];
  public bankStatementsArgs: any = {
    cpfs: ['79858972679', '98765432100'],
    weeks: 4 * 3,
    maxValue: 1500,
    minValue: 50,
  };

  private profiles: CoreBankProfileInterface[] = [
    {
      id: 1,
      cpfCnpj: '79858972679',
      bankCode: 1,
      bankAgencyCode: '2234',
      bankAgencyDigit: '9',
      bankAccountCode: '58339',
      bankAccountDigit: '9',
      rg: '04034484000140',
      bankAgencyName: 'RIO DE JANEIRO (CAP)',
    },
    {
      id: 2,
      cpfCnpj: '98765432100',
      bankCode: 10,
      bankAgencyCode: '72',
      bankAgencyDigit: '8',
      bankAccountCode: '205005',
      bankAccountDigit: '6',
      rg: '28521748000159',
      bankAgencyName: 'NITEROI',
    },
  ];

  constructor() {
    this.setBankStatements();
  }

  /**
   * Every statement consider revenues from monday to thursday,
   * and the statement is send in the next day: friday.
   */

  private setBankStatements() {
    const bankStatements: CoreBankStatementsInterface[] = [];
    const friday = 5;
    for (const cpf of this.bankStatementsArgs.cpfs) {
      for (let week = 0; week < this.bankStatementsArgs.weeks; week++) {
        const date = new Date(Date.now());

        date.setUTCDate(date.getUTCDate() - 7 * week);
        while (date.getUTCDay() !== friday) {
          date.setUTCDate(date.getUTCDate() - 1);
        }
        date.setUTCHours(0, 0, 0, 0);

        const { maxValue, minValue } = this.bankStatementsArgs;
        const randomInt = Math.floor(
          Math.random() * (maxValue - minValue + 1) + minValue,
        );
        const randomDecimal =
          Math.floor(Math.random() * (99 - 0 + 1) + 0) / 100;
        const yearString = date.getUTCFullYear().toString();
        const monthString = (date.getUTCMonth() + 1)
          .toString()
          .padStart(2, '0');
        const dayString = date.getUTCDate().toString().padStart(2, '0');
        bankStatements.push({
          id: week,
          date: `${yearString}-${monthString}-${dayString}`,
          cpfCnpj: cpf,
          amount: randomInt + randomDecimal,
          status: Math.random() > 0.2 ? 'sucesso' : 'falha',
        });
      }
    }
    this.bankStatements = bankStatements;
  }

  public getBankStatements(): CoreBankStatementsInterface[] {
    if (this.bankStatements.length === 0) {
      this.setBankStatements();
    } else {
      const lastDate = new Date(this.bankStatements?.[0]?.date);
      const hoursDifference =
        (new Date(Date.now()).getTime() - lastDate.getTime()) /
        (1000 * 60 * 60);
      if (hoursDifference >= 24 * 7) {
        this.setBankStatements();
      }
    }
    return this.bankStatements;
  }

  public getProfiles(): CoreBankProfileInterface[] {
    return this.profiles;
  }
}
