import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CoreBankProfileInterface } from './interfaces/core-bank-profile.interface';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { UpdateCoreBankInterface } from './interfaces/update-core-bank.interface';
import { CoreBankDataService } from './data/core-bank-data.service';
import { CoreBankStatementsInterface } from './interfaces/core-bank-statements.interface';

@Injectable()
export class CoreBankService {
  constructor(private readonly coreBankDataService: CoreBankDataService) {}

  public updateDataIfNeeded() {
    this.coreBankDataService.updateDataIfNeeded();
  }

  public getProfileByCpfCnpj(cpfCnpj: string): CoreBankProfileInterface {
    // TODO: fetch instead of mockup

    const profiles = this.coreBankDataService.getProfiles();
    const filteredData = profiles.filter((item) => item.cpfCnpj === cpfCnpj);

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

  public getBankStatementsByCpfCnpj(
    cpfCnpj: string,
  ): CoreBankStatementsInterface[] {
    // TODO: fetch instead of mockup
    return this.coreBankDataService
      .getBankStatements()
      .filter((i) => i.cpfCnpj === cpfCnpj);
  }

  public getBankStatementsMocked(): CoreBankStatementsInterface[] {
    // TODO: fetch instead of mockup
    const profiles = this.coreBankDataService.getProfiles();
    const statements = this.coreBankDataService.getBankStatements();
    const filteredData = statements.filter(
      (i) => i.cpfCnpj === profiles[0].cpfCnpj,
    );
    return filteredData;
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
