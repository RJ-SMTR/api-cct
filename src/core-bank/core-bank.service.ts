import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CoreBankInterface } from './interfaces/core-bank.interface';
import { coreBankResponseMockup } from './data/core-bank-response-mockup';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';

@Injectable()
export class CoreBankService {
  public async getCoreBankProfileByCpfCnpj(
    cpfCnpj: string,
  ): Promise<CoreBankInterface> {
    // TODO: fetch instead of mockup

    const coreBankResponseObject = await JSON.parse(coreBankResponseMockup);
    const sgtuResponse: CoreBankInterface[] = coreBankResponseObject.data.map(
      (item) => ({
        id: item.id,
        cpfCnpj: item.cpf,
        bankAgencyName: item.ente,
        bankAgencyCode: item.agencia,
        bankAgencyDigit: item.dvAgencia,
        bankAgencyCnpj: item.cnpj,
        bankAccountCode: item.conta,
        bankAccountDigit: item.dvConta,
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
}
