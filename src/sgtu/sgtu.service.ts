import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { sgtuResponseMockup } from './data/sgtu-response-mockup';
import { SgtuDto } from './dto/sgtu.dto';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { Invite } from 'src/invite/entities/invite.entity';

@Injectable()
export class SgtuService {
  public async getProfileByPermitCode(permitCode: string): Promise<SgtuDto> {
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

  /**
   * Mock successfull request to SGTU service
   */
  public async getGeneratedProfile(invite: Invite): Promise<SgtuDto> {
    const sgtuResponseObject = await JSON.parse(sgtuResponseMockup);
    const sgtuProfile: SgtuDto = sgtuResponseObject.data.map((item) => ({
      id: item.id,
      cpfCnpj: Math.floor(Math.random() * 1e11).toString(),
      rg: item.rg,
      permitCode: invite.user.permitCode,
      fullName: invite.user.fullName || invite.user.email?.split('@')[0],
      plate: item.placa,
      isSgtuBlocked: item.bloqueado,
      email: invite.user.email,
    }))[0];
    return sgtuProfile;
  }
}
