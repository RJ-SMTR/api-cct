import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SgtuInterface } from 'src/sgtu/interfaces/sgtu.interface';
import { SgtuService } from 'src/sgtu/sgtu.service';
import { AuthPreRegisterLicenseeDto } from './dto/auth-pre-register-licensee.dto';

@Injectable()
export class AuthLicenseeService {
  @Inject(SgtuService)
  private readonly sgtuService: SgtuService;

  public async getProfileByCredentials(
    loginDto: AuthPreRegisterLicenseeDto,
  ): Promise<SgtuInterface> {
    // TODO: SGTU fetch instead of sgtuResponseMockup

    const sgtuResponse: SgtuInterface =
      await this.sgtuService.getSgtuProfileByLicensee(loginDto.licensee);

    // Validate if CPF/RG exists in  response
    if (!(loginDto.cpfCnpj === sgtuResponse.cpfCnpj)) {
      throw new HttpException(
        {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            cpfCnpj: 'cpfCnpjDoesNotMatch',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return sgtuResponse;
  }
}
