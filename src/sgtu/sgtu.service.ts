import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SgtuInterface } from './interfaces/sgtu.interface';

@Injectable()
export class SgtuService {
  private sgtuResponseMockup = JSON.stringify({
    data: [
      {
        id: '1',
        cpf: '79858972679',
        rg: '987654321',
        autorizacao: '213890329890312',
        nome: 'Usuário 1',
        placa: 'ABC1234',
        telefone: '999999999',
        ativo: true,
      },
      {
        id: '2',
        cpf: '98765432100',
        rg: '123456789',
        autorizacao: '218302734908664',
        nome: 'Usuário 2',
        placa: 'DEF4567',
        telefone: '888888888',
        ativo: false,
      },
    ],
  });

  public async getSgtuProfileByLicensee(
    licensee: string,
  ): Promise<SgtuInterface> {
    // TODO: fetch instead of mockup

    const sgtuResponseObject = await JSON.parse(this.sgtuResponseMockup);
    const sgtuResponse: SgtuInterface[] = sgtuResponseObject.data.map(
      (item) => ({
        id: item.id,
        cpfCnpj: item.cpf,
        rg: item.rg,
        licensee: item.autorizacao,
        name: item.nome,
        plate: item.placa,
        phone: item.telefone,
        active: item.ativo,
      }),
    );

    const filteredData = sgtuResponse.filter(
      (item) => item.licensee === licensee,
    );

    if (filteredData.length === 1) {
      return filteredData[0];
    } else if (filteredData.length > 1) {
      throw new HttpException(
        {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            licensee: 'multipleSgtuProfilesFound',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    } else {
      throw new HttpException(
        {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            licensee: 'sgtuProfileNotFound',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }
}
