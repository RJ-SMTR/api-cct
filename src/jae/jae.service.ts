import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JaeDataService } from './data/jae-data.service';
import { JaeProfileInterface } from './interfaces/jae-profile.interface';
import { IJaeTicketRevenue } from './interfaces/jae-ticket-revenue.interface';
import { User } from 'src/users/entities/user.entity';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { IJaeTicketRevenueGroup } from './interfaces/jae-ticket-revenue-group.interface';

@Injectable()
export class JaeService {
  constructor(private jaeDataService: JaeDataService) {}

  async updateDataIfNeeded(): Promise<void> {
    return await this.jaeDataService.updateDataIfNeeded();
  }

  public async getTicketRevenuesByPermitCode(
    ticketValidatorId: string,
  ): Promise<IJaeTicketRevenue[]> {
    return await this.jaeDataService.getTicketRevenuesByPermitCode(
      ticketValidatorId,
    );
  }

  public groupTicketRevenuesByWeek(
    ticketRevenues: IJaeTicketRevenue[],
  ): IJaeTicketRevenueGroup[] {
    const result = ticketRevenues.reduce(
      (acc: Record<string, IJaeTicketRevenueGroup>, item) => {
        const dateGroup = item.transactionDateTime.slice(0, 10);
        if (!acc[dateGroup]) {
          acc[dateGroup] = {
            ...item,
            transactionCount: 0,
            transactionValueSum: 0,
            transactionTypeCount: {
              full: 0,
              half: 0,
              free: 0,
            },
            transportIntegrationTypeCount: {
              null: 0,
              van: 0,
              bus_supervia: 0,
            },
            paymentMediaTypeCount: {
              card: 0,
              phone: 0,
            },
          };
        }
        acc[dateGroup].transactionCount += 1;
        acc[dateGroup].transactionValueSum += item.transactionValue;
        acc[dateGroup].transactionTypeCount[item.transactionType as any] += 1;
        acc[dateGroup].transportIntegrationTypeCount[
          item.transportIntegrationType as any
        ] += 1;
        acc[dateGroup].paymentMediaTypeCount[item.paymentMediaType as any] += 1;
        return acc;
      },
      {},
    );
    const resultList = Object.keys(result).map(
      (dateGroup) => result[dateGroup],
    );
    return resultList;
  }

  async getTicketRevenuesMocked(
    pagination?: IPaginationOptions,
  ): Promise<IJaeTicketRevenue[]> {
    return await this.jaeDataService.getTicketRevenuesMocked(pagination);
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
      vehicleOrderNumberId: 1,
      passValidatorId: String(user.passValidatorId),
      permitCode: Math.floor(Math.random() * 1e15).toString(),
      vehiclePlate: 'ABC123',
    };
  }
}
