import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CoreBankInterface } from './interfaces/core-bank.interface';

@Injectable()
export class CoreBankService {
  private coreBankResponseMockup = JSON.stringify({
    data: [
      {
        id: '1',
        cpf: '79858972679',
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
        agencia: '72',
        dvAgencia: '8',
        conta: '205005',
        dvConta: '6',
        cnpj: '28521748000159',
        ente: 'NITEROI',
      },
    ],
  });

  public async getCoreBankProfileByCpfCnpj(
    cpfCnpj: string,
  ): Promise<CoreBankInterface> {
    // TODO: fetch instead of mockup

    const coreBankResponseObject = await JSON.parse(
      this.coreBankResponseMockup,
    );
    const sgtuResponse: CoreBankInterface[] = coreBankResponseObject.data.map(
      (item) => ({
        id: item.id,
        cpfCnpj: item.cpf,
        agencyName: item.ente,
        agencyCode: item.agencia,
        agencyDigit: item.dvAgencia,
        agencyCnpj: item.cnpj,
        accountCode: item.conta,
        accountDigit: item.dvConta,
      }),
    );

    const filteredData = sgtuResponse.filter(
      (item) => item.cpfCnpj === cpfCnpj,
    );

    if (filteredData.length === 1) {
      return filteredData[0];
    } else if (filteredData.length > 1) {
      throw new HttpException(
        {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            cpfCnpj: 'multipleCoreBankProfilesFound',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    } else {
      throw new HttpException(
        {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            cpfCnpj: 'coreBankProfileNotFound',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }
}
