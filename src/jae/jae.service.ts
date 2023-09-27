import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JaeDataService } from './data/jae-data.service';
import { JaeProfileInterface } from './interfaces/jae-profile.interface';
import { JaeTicketRevenueInterface } from './interfaces/jae-ticket-revenue.interface';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class JaeService {
  constructor(private jaeDataService: JaeDataService) {}

  public async getTicketRevenuesByPermitCode(
    ticketValidatorId: string,
  ): Promise<JaeTicketRevenueInterface[]> {
    return await this.jaeDataService.getTicketRevenuesByPermitCode(
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

  public getGeneratedProfileByUser(user: User): JaeProfileInterface {
    return {
      id: 1,
      passValidatorId: String(user.passValidatorId),
      plate: 'ABC123',
      permitCode: Math.floor(Math.random() * 1e15).toString(),
    };
  }
}
