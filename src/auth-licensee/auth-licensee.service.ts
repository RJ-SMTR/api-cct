import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SgtuService } from 'src/sgtu/sgtu.service';
import { AuthRegisterLicenseeDto } from './dto/auth-register-licensee.dto';
import { UsersService } from 'src/users/users.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { Role } from 'src/roles/entities/role.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { CoreBankInterface } from 'src/core-bank/interfaces/core-bank.interface';
import { BaseValidator } from 'src/utils/validators/base-validator';
import { SgtuDto } from 'src/sgtu/dto/sgtu.dto';
import { InviteService } from 'src/invite/invite.service';
import { AuthLicenseeInviteProfileInterface } from './interfaces/auth-licensee-invite-profile.interface';

@Injectable()
export class AuthLicenseeService {
  constructor(
    private usersService: UsersService,
    private baseValidator: BaseValidator,
    private sgtuService: SgtuService,
    private coreBankService: CoreBankService,
    private inviteService: InviteService,
  ) {}

  async getInviteProfileByHash(
    hash: string,
  ): Promise<AuthLicenseeInviteProfileInterface> {
    const inviteProfile = this.inviteService.findByHash(hash);

    if (!inviteProfile) {
      throw new HttpException(
        {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            permitCode: 'inviteHashNotFound',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const sgtuProfile: SgtuDto =
      await this.sgtuService.getSgtuProfileByLicensee(inviteProfile.permitCode);

    await this.baseValidator.validateOrReject(sgtuProfile, SgtuDto);

    const inviteResponse: AuthLicenseeInviteProfileInterface = {
      fullName: sgtuProfile.fullName,
      permitCode: sgtuProfile.permitCode,
      email: sgtuProfile.email,
      hash: inviteProfile.hash,
    };

    return inviteResponse;
  }

  async register(
    registerDto: AuthRegisterLicenseeDto,
    hash: string,
  ): Promise<void | object> {
    const sgtuProfile: SgtuDto =
      await this.sgtuService.getSgtuProfileByLicensee(registerDto.permitCode);

    await this.baseValidator.validateOrReject(sgtuProfile, SgtuDto);

    const coreBankProfile: CoreBankInterface =
      await this.coreBankService.getCoreBankProfileByCpfCnpj(
        sgtuProfile.cpfCnpj,
      );

    const email = sgtuProfile.email;

    await this.usersService.create({
      ...registerDto,
      password: registerDto.password,
      hash: hash,
      email: email,
      fullName: sgtuProfile.fullName,
      cpfCnpj: sgtuProfile.cpfCnpj,
      permitCode: sgtuProfile.permitCode,
      sgtuBlocked: sgtuProfile.sgtuBlocked,
      bankAgency: coreBankProfile.bankAgencyCode,
      bankAccount: coreBankProfile.bankAccountCode,
      bankAccountDigit: coreBankProfile.bankAccountDigit,
      role: {
        id: RoleEnum.user,
      } as Role,
      status: {
        id: StatusEnum.active,
      } as Status,
    });
  }
}
