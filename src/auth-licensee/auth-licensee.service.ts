import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SgtuService } from 'src/sgtu/sgtu.service';
import { AuthRegisterLicenseeDto } from './dto/auth-register-licensee.dto';
import { UsersService } from 'src/users/users.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { Role } from 'src/roles/entities/role.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { BaseValidator } from 'src/utils/validators/base-validator';
import { SgtuDto } from 'src/sgtu/dto/sgtu.dto';
import { InviteService } from 'src/invite/invite.service';
import { AuthLicenseeInviteProfileInterface } from './interfaces/auth-licensee-invite-profile.interface';
import { AuthLicenseeLoginDto } from './dto/auth-licensee-login.dto';
import { LoginResponseType } from 'src/utils/types/auth/login-response.type';
import { AuthProvidersEnum } from 'src/auth/auth-providers.enum';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { JaeService } from 'src/jae/jae.service';
import { JaeProfileInterface } from 'src/jae/interfaces/jae-profile.interface';

@Injectable()
export class AuthLicenseeService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private sgtuService: SgtuService,
    private jaeService: JaeService,
    private inviteService: InviteService,
    private baseValidator: BaseValidator,
  ) {}

  async validateLogin(
    loginDto: AuthLicenseeLoginDto,
    onlyAdmin: boolean,
  ): Promise<LoginResponseType> {
    const user = await this.usersService.findOne({
      permitCode: loginDto.permitCode,
    });

    if (
      !user ||
      (user?.role &&
        !(onlyAdmin ? [RoleEnum.admin] : [RoleEnum.user]).includes(
          user.role.id,
        ))
    ) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            email: 'notFound',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.provider !== AuthProvidersEnum.email) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            email: `needLoginViaProvider:${user.provider}`,
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isValidPassword = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isValidPassword) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            password: 'incorrectPassword',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = this.jwtService.sign({
      id: user.id,
      role: user.role,
    });

    return { token, user };
  }

  async getProfileByHash(
    hash: string,
  ): Promise<AuthLicenseeInviteProfileInterface> {
    const inviteProfile = this.inviteService.findByHash(hash);

    if (!inviteProfile) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            permitCode: 'inviteHashNotFound',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const sgtuProfile: SgtuDto = await this.sgtuService.getProfileByLicensee(
      inviteProfile.permitCode,
    );

    await this.baseValidator.validateOrReject(
      sgtuProfile,
      SgtuDto,
      HttpStatus.UNAUTHORIZED,
      HttpErrorMessages.UNAUTHORIZED,
    );

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
    const inviteProfile = this.inviteService.findByHash(hash);
    if (!inviteProfile) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            internal: 'inviteHashNotFound',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const sgtuProfile: SgtuDto = await this.sgtuService.getProfileByLicensee(
      inviteProfile.permitCode,
    );

    await this.baseValidator.validateOrReject(
      sgtuProfile,
      SgtuDto,
      HttpStatus.UNAUTHORIZED,
      HttpErrorMessages.UNAUTHORIZED,
    );

    const jaeProfile: JaeProfileInterface =
      await this.jaeService.getProfileByPermitCode(inviteProfile.permitCode);

    const email = sgtuProfile.email;

    const user = await this.usersService.create({
      password: registerDto.password,
      hash: hash,
      email: email,
      fullName: sgtuProfile.fullName,
      cpfCnpj: sgtuProfile.cpfCnpj,
      permitCode: sgtuProfile.permitCode,
      isSgtuBlocked: sgtuProfile.isSgtuBlocked,
      passValidatorId: jaeProfile.passValidatorId,
      role: {
        id: RoleEnum.user,
      } as Role,
      status: {
        id: StatusEnum.active,
      } as Status,
    });

    const token = this.jwtService.sign({
      id: user.id,
      role: user.role,
    });

    return { token, user };
  }
}
