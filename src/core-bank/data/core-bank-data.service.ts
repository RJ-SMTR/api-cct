import { Injectable } from '@nestjs/common';

@Injectable()
export class CoreBankDataService {
  private bankStatements: string;
  public bankStatementsArgs: any = {
    cpfs: ['79858972679', '98765432100'],
    weeks: 4 * 3,
    maxValue: 1500,
    minValue: 50,
  };

  private profiles = JSON.stringify({
    data: [
      {
        id: '1',
        cpf: '79858972679',
        banco: 1,
        agencia: '2234',
        dvAgencia: '9',
        conta: '58339',
        dvConta: '9',
        cnpj: '04034484000140',
        ente: 'RIO DE JANEIRO (CAP)',
      },
      {
        id: '2',
        cpf: '98765432100',
        banco: 10,
        agencia: '72',
        dvAgencia: '8',
        conta: '205005',
        dvConta: '6',
        cnpj: '28521748000159',
        ente: 'NITEROI',
      },
    ],
  });

  constructor() {
    this.setBankStatements();
  }

  /**
       * @example
       ```js
       {
          cpf: {
              'cpf1':{
                  data: [
                      {
                          id: 1,
                          data: '2023-08-11',
                          cpf: 'cpf1',
                          valor: 1234.56
                          status: 'sucesso'
                      },
                      ...
                  ]
              }
          }
       }
       ```
       */

  private setBankStatements() {
    let tripsIncomeResponseJson: any = { cpf: {} };
    for (const cpf of this.bankStatementsArgs.cpfs) {
      tripsIncomeResponseJson.cpf[cpf] = { data: [] };
      for (let i = 0; i < this.bankStatementsArgs.weeks; i++) {
        const date = new Date(Date.now());
        date.setDate(date.getDate() - 7 * i);
        while (date.getDay() !== 5) {
          // weekday != Friday
          date.setDate(date.getDate() - 1);
        }

        date.setUTCHours(0, 0, 0, 0);
        const randomInt = Math.floor(
          Math.random() *
            (this.bankStatementsArgs.maxValue -
              this.bankStatementsArgs.minValue +
              1) +
            this.bankStatementsArgs.minValue,
        );
        const randomDecimal =
          Math.floor(Math.random() * (99 - 0 + 1) + 0) / 100;
        tripsIncomeResponseJson.cpf[cpf].data.push({
          id: i,
          data: `${date.getFullYear().toString()}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, '0')}-${date
            .getUTCDate()
            .toString()
            .padStart(2, '0')}`,
          cpf: cpf,
          valor: randomInt + randomDecimal,
          status: Math.random() > 0.2 ? 'sucesso' : 'falha',
        });
      }
    }
    tripsIncomeResponseJson = JSON.stringify(tripsIncomeResponseJson);
    this.bankStatements = tripsIncomeResponseJson;
  }

  public getBankStatements(): string {
    const cpf = this.bankStatementsArgs.cpfs[0];
    const lastDate = new Date(
      JSON.parse(this.bankStatements).cpf[cpf].data[0].data,
    );
    const hoursDifference =
      (new Date(Date.now()).getTime() - lastDate.getTime()) / (1000 * 60 * 60);
    if (hoursDifference >= 24 * 7) {
      this.setBankStatements();
    }
    return this.bankStatements;
  }

  public getProfiles(): string {
    return this.profiles;
  }
}
