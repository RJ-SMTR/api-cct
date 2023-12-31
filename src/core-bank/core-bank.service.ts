import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ICoreBankProfile } from './interfaces/core-bank-profile.interface';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { UpdateCoreBankInterface } from './interfaces/update-core-bank.interface';
import { CoreBankDataService } from './data/core-bank-data.service';
import { ICoreBankStatements } from './interfaces/core-bank-statements.interface';

@Injectable()
export class CoreBankService {
  constructor(private readonly coreBankDataService: CoreBankDataService) {}

  public updateDataIfNeeded() {
    this.coreBankDataService.updateDataIfNeeded();
  }

  public isPermitCodeExists(permitCode?: string): boolean {
    return (
      this.coreBankDataService
        .getProfiles()
        .find((i) => i.permitCode === permitCode) !== undefined
    );
  }

  public getProfileByPermitCode(permitCode?: string): ICoreBankProfile {
    // TODO: fetch instead of mockup

    const profiles = this.coreBankDataService.getProfiles();
    const filteredData = profiles.filter(
      (item) => item.permitCode === permitCode,
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

  public getBankStatementsByPermitCode(
    permitCode?: string,
  ): ICoreBankStatements[] {
    // TODO: fetch instead of mockup
    return this.coreBankDataService
      .getBankStatements()
      .filter((i) => i.permitCode === permitCode);
  }

  public getBankStatementsMocked(): ICoreBankStatements[] {
    // TODO: fetch instead of mockup
    const profiles = this.coreBankDataService.getProfiles();
    const statements = this.coreBankDataService.getBankStatements();
    const filteredData = statements.filter(
      (i) => i.permitCode === profiles[0].permitCode,
    );
    return filteredData;
  }

  update(cpfCnpj: string, coreBankProfile: UpdateCoreBankInterface) {
    // TODO: PATCH bank data to core bank API
    console.log(
      `CoreBankService.update():\n` +
        `PATCH core bank:\n` +
        `\tcpfCnpj ${cpfCnpj}\n` +
        `\tProfile: ${JSON.stringify(coreBankProfile)}`,
    );
  }
}
