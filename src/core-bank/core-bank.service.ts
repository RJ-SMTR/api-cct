import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CoreBankProfileInterface } from './interfaces/core-bank-profile.interface';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { UpdateCoreBankInterface } from './interfaces/update-core-bank.interface';
import { CoreBankDataService } from './data/core-bank-data.service';
import { NullableType } from 'src/utils/types/nullable.type';

@Injectable()
export class CoreBankService {
  constructor(private readonly coreBankDataService: CoreBankDataService) {}

  public async getProfileByCpfCnpj(
    cpfCnpj: string,
  ): Promise<CoreBankProfileInterface> {
    // TODO: fetch instead of mockup

    const coreBankResponseObject = JSON.parse(
      await this.coreBankDataService.getProfiles(),
    );
    const responseMapped: CoreBankProfileInterface[] =
      coreBankResponseObject.data.map((item) => ({
        id: item.id,
        cpfCnpj: item.cpf,
        bankCode: item.banco,
        bankAgencyName: item.ente,
        bankAgencyCode: item.agencia,
        bankAgencyDigit: item.dvAgencia,
        bankAgencyCnpj: item.cnpj,
        bankAccountCode: item.conta,
        bankAccountDigit: item.dvConta,
      }));

    const filteredData = responseMapped.filter(
      (item) => item.cpfCnpj === cpfCnpj,
    );

    if (filteredData.length === 1) {
      return filteredData[0];
    } else if (filteredData.length > 1) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            cpfCnpj: 'multipleCoreBankProfilesFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            cpfCnpj: 'coreBankProfileNotFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Return mokcked json API response
   * @param cpfCnpj 
   * @example
   ```js
    {
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
  ```
   */
  public getBankStatementsByCpfCnpj(cpfCnpj: string): NullableType<string> {
    // TODO: fetch instead of mockup

    const coreBankResponseObject = JSON.parse(
      this.coreBankDataService.getBankStatements(),
    )?.cpf?.[cpfCnpj];
    if (coreBankResponseObject === undefined) {
      return null;
    }

    return JSON.stringify(coreBankResponseObject);
  }

  update(cpfCnpj: string, coreBankProfile: UpdateCoreBankInterface) {
    // TODO: PATCH bank data to core bank API
    console.log(
      `PATCH core bank:\n` +
        `\tcpfCnpj ${cpfCnpj}\n` +
        `\tProfile: ${JSON.stringify(coreBankProfile)}`,
    );
  }
}
