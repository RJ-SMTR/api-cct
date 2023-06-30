import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SgtuInterface } from 'src/sgtu/interfaces/sgtu.interface';
import { SgtuService } from 'src/sgtu/sgtu.service';
import { AuthPreRegisterLicenseeDto } from './dto/auth-pre-register-licensee.dto';
import { AuthRegisterLicenseeDto } from './dto/auth-register-licensee.dto';
import * as crypto from 'crypto';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { UsersService } from 'src/users/users.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { Role } from 'src/roles/entities/role.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AuthLicenseeService {
  constructor(
    private sgtuService: SgtuService,
    private usersService: UsersService,
    private mailService: MailService,
  ) {}

  public async getProfileByCredentials(
    loginDto: AuthPreRegisterLicenseeDto,
  ): Promise<SgtuInterface> {
    // TODO: SGTU fetch instead of sgtuResponseMockup

    const sgtuProfile: SgtuInterface =
      await this.sgtuService.getSgtuProfileByLicensee(loginDto.licensee);

    // Validate if CPF/RG exists in  response
    if (!(loginDto.cpfCnpj === sgtuProfile.cpfCnpj)) {
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

    return sgtuProfile;
  }
  async register(dto: AuthRegisterLicenseeDto): Promise<void | object> {
    const hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const sgtuProfile: SgtuInterface =
      await this.sgtuService.getSgtuProfileByLicensee(dto.licensee);

    console.log(sgtuProfile);
    await this.usersService.create({
      ...sgtuProfile,
      ...dto,
      role: {
        id: RoleEnum.user,
      } as Role,
      status: {
        id: StatusEnum.inactive,
      } as Status,
      hash,
    });
    console.log(hash);

    const link = await this.mailService.userSignUp({
      to: dto.email,
      data: {
        hash,
      },
    });

    return { link: link };
  }
}
