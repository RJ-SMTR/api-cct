import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JaeDataService } from './data/jae-data.service';
import { JaeProfileInterface } from './interfaces/jae-profile.interface';

@Injectable()
export class JaeService {
  constructor(private jaeDataService: JaeDataService) {}

  public async getGtfsDataByValidator(ticketValidatorId: string) {
    return await this.jaeDataService.getGtfsDataByValidator(ticketValidatorId);
  }

  public async getTicketRevenuesByValidator(ticketValidatorId: string) {
    return await this.jaeDataService.getTicketRevenuesByValidator(
      ticketValidatorId,
    );
  }

  public getProfileByLicensee(permitCode: string): JaeProfileInterface {
    // TODO: fetch instead of mockup

    const jaeResponseObject = this.jaeDataService.getProfiles();
    const jaeResponse: JaeProfileInterface[] = jaeResponseObject.map(
      (item) => ({
        id: item.id,
        permitCode: item.autorizacao,
        plate: item.placa,
        passValidatorId: item.validador,
      }),
    );

    const filteredData = jaeResponse.filter(
      (item) => item.permitCode === permitCode,
    );

    if (filteredData.length === 1) {
      return filteredData[0];
    } else if (filteredData.length > 1) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          details: {
            permitCode: 'multipleJaeProfilesFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          details: {
            permitCode: 'jaeProfileNotFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
