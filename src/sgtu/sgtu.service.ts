import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { sgtuResponseMockup } from './data/sgtu-response-mockup';
import { SgtuDto } from './dto/sgtu.dto';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';

@Injectable()
export class SgtuService {
  public async getProfileByLicensee(permitCode: string): Promise<SgtuDto> {
    // TODO: fetch instead of mockup

    const sgtuResponseObject = await JSON.parse(sgtuResponseMockup);
    const sgtuResponse: SgtuDto[] = sgtuResponseObject.data.map((item) => ({
      id: item.id,
      cpfCnpj: item.cpf,
      rg: item.rg,
      permitCode: item.autorizacao,
      fullName: item.nome,
      plate: item.placa,
      phone: item.telefone,
      isSgtuBlocked: item.bloqueado,
      email: item.email,
    }));

    const filteredData = sgtuResponse.filter(
      (item) => item.permitCode === permitCode,
    );

    if (filteredData.length === 1) {
      return filteredData[0];
    } else if (filteredData.length > 1) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            permitCode: 'multipleSgtuProfilesFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            permitCode: 'sgtuProfileNotFound',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
