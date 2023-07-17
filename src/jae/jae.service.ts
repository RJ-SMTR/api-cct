import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JaeInterface } from './interfaces/jae.interface';
import { jaeResponseMockup } from './data/jae-response-mockup';

@Injectable()
export class JaeService {
  public async getProfileByLicensee(permitCode: string): Promise<JaeInterface> {
    // TODO: fetch instead of mockup

    const jaeResponseObject = await JSON.parse(jaeResponseMockup);
    const jaeResponse: JaeInterface[] = jaeResponseObject.data.map((item) => ({
      id: item.id,
      permitCode: item.autorizacao,
      plate: item.placa,
      passValidatorId: item.validador,
    }));

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
