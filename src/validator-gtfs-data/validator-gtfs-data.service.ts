import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JaeService } from 'src/jae/jae.service';
import { User } from 'src/users/entities/user.entity';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { ValidatorGtfsDataInterface } from './interface/validator-gtfs-data.interface';

@Injectable()
export class ValidatorGtfsDataService {
  constructor(private readonly jaeService: JaeService) {}

  public async getDataFromUser(
    user: User,
  ): Promise<ValidatorGtfsDataInterface[]> {
    if (!user.permitCode || !user.passValidatorId) {
      throw new HttpException(
        {
          details: {
            user: {
              ...(!user.permitCode && { permitCode: 'fieldIsEmpty' }),
              ...(!user.passValidatorId && { passValidatorId: 'fieldIsEmpty' }),
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // TODO: fetch instead of mockup
    const ticketRevenuesResponseObject = await JSON.parse(
      await this.jaeService.getGtfsDataByValidator(user.passValidatorId),
    ).data;

    const ticketRevenuesResponse: ValidatorGtfsDataInterface[] =
      ticketRevenuesResponseObject.map(
        (item) =>
          ({
            passValidatorId: item.validador,
            data: item.data,
          } as ValidatorGtfsDataInterface),
      );

    if (!ticketRevenuesResponse) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            response: 'unexpectedDataFormat',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const filteredData = ticketRevenuesResponse.filter(
      (i) => i.passValidatorId === user.passValidatorId,
    );

    return filteredData;
  }
}
