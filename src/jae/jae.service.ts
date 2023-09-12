import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JaeDataService } from './data/jae-data.service';
import { JaeProfileInterface } from './interfaces/jae-profile.interface';
import { JaeTicketRevenueInterface } from './interfaces/jae-ticket-revenue.interface';

@Injectable()
export class JaeService {
  constructor(private jaeDataService: JaeDataService) {}

  public async getTicketRevenuesByValidator(
    ticketValidatorId: string,
  ): Promise<JaeTicketRevenueInterface[]> {
    return await this.jaeDataService.getTicketRevenuesByValidator(
      ticketValidatorId,
    );
  }

  public getProfileByPermitCode(permitCode: string): JaeProfileInterface {
    // TODO: fetch instead of mockup

    const jaeResponse = this.jaeDataService.getProfiles();

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
