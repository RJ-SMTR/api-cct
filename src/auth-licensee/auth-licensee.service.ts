import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SgtuService } from 'src/sgtu/sgtu.service';
import { AuthRegisterLicenseeDto } from './dto/auth-register-licensee.dto';
import { UsersService } from 'src/users/users.service';
import { RoleEnum } from 'src/roles/roles.enum';
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
import { InviteStatusEnum } from 'src/invite-statuses/invite-status.enum';

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

  async getInviteProfile(
    hash: string,
  ): Promise<AuthLicenseeInviteProfileInterface> {
    const invite = await this.inviteService.findByHash(hash);

    if (!invite) {
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

    const user = await this.usersService.getOne({ id: invite.user.id });

    if (user.id !== invite.user.id || typeof user.permitCode !== 'string') {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            user: {
              ...(user.id !== invite.user.id && {
                id: 'invalidUserForInviteHash',
              }),
              ...(typeof user.permitCode !== 'string' && {
                permitCode: 'cantBeEmpty',
              }),
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const sgtuProfile: SgtuDto = await this.sgtuService.getGeneratedProfile(
      invite,
    );

    await this.baseValidator.validateOrReject(
      sgtuProfile,
      SgtuDto,
      HttpStatus.UNAUTHORIZED,
      HttpErrorMessages.UNAUTHORIZED,
    );

    if (
      sgtuProfile.permitCode !== user.permitCode ||
      sgtuProfile.email !== user.email
    ) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            user: {
              ...(sgtuProfile.permitCode !== user.permitCode && {
                id: 'differentPermitCodeFound',
              }),
              ...(sgtuProfile.email !== user.email && {
                permitCode: 'differentEmailFound',
              }),
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const inviteResponse: AuthLicenseeInviteProfileInterface = {
      fullName: sgtuProfile.fullName,
      permitCode: sgtuProfile.permitCode,
      email: sgtuProfile.email,
      hash: invite.hash,
    };

    return inviteResponse;
  }

  async concludeRegistration(
    registerDto: AuthRegisterLicenseeDto,
    hash: string,
  ): Promise<void | object> {
    const invite = await this.inviteService.findByHash(hash);
    if (!invite || invite.inviteStatus.id !== InviteStatusEnum.sent) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            invite: {
              ...(!invite && { hash: 'inviteHashNotFound' }),
              ...(invite &&
                invite.inviteStatus.id !== InviteStatusEnum.sent && {
                  inviteStatus: `expected 'sent' but got '${invite.inviteStatus.name}'`,
                }),
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.usersService.getOne({ id: invite.user.id });

    if (
      user.id !== invite.user.id ||
      user.permitCode === undefined ||
      user.email === null
    ) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            user: {
              ...(user.id !== invite.user.id && {
                id: 'invalidUserForInviteHash',
              }),
              ...(user.permitCode === undefined && {
                permitCode: 'cantBeEmpty',
              }),
              ...(user.email === null && { email: 'cantBeEmpty' }),
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const sgtuProfile: SgtuDto = await this.sgtuService.getGeneratedProfile(
      invite,
    );

    await this.baseValidator.validateOrReject(
      sgtuProfile,
      SgtuDto,
      HttpStatus.UNAUTHORIZED,
      HttpErrorMessages.UNAUTHORIZED,
    );

    const jaeProfile: JaeProfileInterface =
      this.jaeService.getGeneratedProfileByUser(user);

    const email = user.email;

    await this.inviteService.update(invite.id, {
      inviteStatus: {
        id: InviteStatusEnum.used,
      },
    });

    const updatedUser = await this.usersService.update(user.id, {
      password: registerDto.password,
      hash: hash,
      email: email,
      fullName: sgtuProfile.fullName,
      cpfCnpj: sgtuProfile.cpfCnpj,
      permitCode: sgtuProfile.permitCode,
      isSgtuBlocked: sgtuProfile.isSgtuBlocked,
      passValidatorId: jaeProfile.passValidatorId,
      status: {
        id: StatusEnum.active,
      } as Status,
    });

    const token = this.jwtService.sign({
      id: updatedUser.id,
      role: updatedUser.role,
    });

    return {
      token,
      user: updatedUser,
    };
  }
}
