import { Injectable } from '@nestjs/common';
import { SgtuService } from 'src/sgtu/sgtu.service';
import { PreRegisterLicenseeDto } from './dto/pre-register-licensee.dto';
import { AuthRegisterLicenseeDto } from './dto/register-licensee.dto';
import { UsersService } from 'src/users/users.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { Role } from 'src/roles/entities/role.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { CoreBankInterface } from 'src/core-bank/interfaces/core-bank.interface';
import { LicenseeProfileInterface } from './interfaces/licensee-profile.interface';
import { BaseValidator } from 'src/utils/validators/base-validator';
import { SgtuDto } from 'src/sgtu/dto/sgtu.dto';

@Injectable()
export class AuthLicenseeService {
  constructor(
    private usersService: UsersService,
    private baseValidator: BaseValidator,
    private sgtuService: SgtuService,
    private coreBankService: CoreBankService,
  ) {}

  public async getProfileByCredentials(
    preRegisterDto: PreRegisterLicenseeDto,
  ): Promise<LicenseeProfileInterface> {
    const sgtuProfile: SgtuDto =
      await this.sgtuService.getSgtuProfileByLicensee(
        preRegisterDto.permitCode,
      );

    await this.baseValidator.validateOrReject(sgtuProfile, SgtuDto);

    const coreBankProfile: CoreBankInterface =
      await this.coreBankService.getCoreBankProfileByCpfCnpj(
        sgtuProfile.cpfCnpj,
      );

    const licenseeProfile: LicenseeProfileInterface = {
      cpfCnpj: sgtuProfile.cpfCnpj,
      permitCode: sgtuProfile.permitCode,
      fullName: sgtuProfile.fullName,
      sgtuBlocked: sgtuProfile.sgtuBlocked,
      email: sgtuProfile.email,
      bankAgency: coreBankProfile.bankAgencyCode,
      bankAccount: coreBankProfile.bankAccountCode,
      bankAccountDigit: coreBankProfile.bankAccountDigit,
    };
    console.log(licenseeProfile);

    return licenseeProfile;
  }

  async register(registerDto: AuthRegisterLicenseeDto): Promise<void | object> {
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
