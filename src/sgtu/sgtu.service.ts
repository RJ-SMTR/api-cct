import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { sgtuResponseMockup } from './data/sgtu-response-mockup';
import { SgtuDto } from './dto/sgtu.dto';

@Injectable()
export class SgtuService {
  public async getSgtuProfileByLicensee(
    permitCode: string,
  ): Promise<SgtuDto> {
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
      sgtuBlocked: item.bloqueado,
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
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            permitCode: 'multipleSgtuProfilesFound',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    } else {
      throw new HttpException(
        {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            permitCode: 'sgtuProfileNotFound',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }
}
