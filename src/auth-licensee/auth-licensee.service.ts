import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthProvidersEnum } from 'src/auth/auth-providers.enum';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { HttpStatusMessage } from 'src/utils/enums/http-error-message.enum';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { LoginResponseType } from 'src/utils/types/auth/login-response.type';
import { Nullable } from '../utils/types/nullable.type';
import { AuthLicenseeLoginDto } from './dto/auth-licensee-login.dto';
import { AuthRegisterLicenseeDto } from './dto/auth-register-licensee.dto';
import { IALConcludeRegistration } from './interfaces/al-conclude-registration.interface';
import { IALInviteProfile } from './interfaces/al-invite-profile.interface';
import { CustomLogger } from 'src/utils/custom-logger';

@Injectable()
export class AuthLicenseeService {
  private logger = new CustomLogger('AuthLicenseeService', {
    timestamp: true,
  });

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private mailHistoryService: MailHistoryService,
  ) { }

  async validateLogin(
    loginDto: AuthLicenseeLoginDto,
    role: RoleEnum,
  ): Promise<LoginResponseType> {
    const user = await this.usersService.getOne({
      permitCode: loginDto.permitCode,
    });

    await this.validateDuplicatedUser(user);
    this.validateRole(user, role);

    if (
      user?.status?.id === undefined ||
      user?.status?.id !== StatusEnum.active
    ) {
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
          details: {
            status: 'notActive',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.provider !== AuthProvidersEnum.email) {
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
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
      throw CommonHttpException.detailField(
        'password',
        'incorrectPassword',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = this.jwtService.sign({
      id: user.id,
      role: user.role,
    });

    return { token, user };
  }

  validateRole(user: User, role: RoleEnum) {
    if (!user?.role || user.role.id !== role) {
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
          details: {
            user: {
              error: 'invalidRole',
              role: user?.role?.id,
              expectedRole: role,
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async validateDuplicatedUser(user: Nullable<User>) {
    if (!user) {
      return;
    }
    const duplicatedMail = user.email
      ? await this.usersService.findMany({ where: { email: user.email } })
      : [];
    const duplicatedPermitCode = user.permitCode
      ? await this.usersService.findMany({where: { permitCode: user.permitCode }})
      : [];
    if (duplicatedMail.length > 1 || duplicatedPermitCode.length > 1) {
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
          details: {
            ...(duplicatedMail.length > 1
              ? { email: 'duplicated', emailValue: duplicatedMail[0]?.email }
              : {}),
            ...(duplicatedPermitCode.length > 1
              ? {
                permitCode: 'duplicated',
                permitCodeValue: duplicatedPermitCode[0]?.permitCode,
              }
              : {}),
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async getInviteProfile(hash: string): Promise<IALInviteProfile> {
    const invite = await this.mailHistoryService.getOne({ hash });

    if (invite.inviteStatus.id !== InviteStatusEnum.sent) {
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
          details: {
            invite: {
              inviteStatus: `Invite is not 'sent' yet`,
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.usersService.getOne({ id: invite.user.id });

    if (
      user.id !== invite.user.id ||
      !user.permitCode ||
      !user.fullName ||
      !user.email
    ) {
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
          details: {
            user: {
              ...(user.id !== invite.user.id && {
                id: 'invalidUserForInviteHash',
              }),
              ...(!user.permitCode && { permitCode: 'campoNulo' }),
              ...(!user.fullName && { fullName: 'campoNulo' }),
              ...(!user.email && { email: 'campoNulo' }),
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const inviteResponse: IALInviteProfile = {
      fullName: user.fullName as string,
      permitCode: user.permitCode,
      email: user.email,
      hash: invite.hash,
      inviteStatus: invite.inviteStatus,
    };

    return inviteResponse;
  }

  async concludeRegistration(
    registerDto: AuthRegisterLicenseeDto,
    hash: string,
  ): Promise<IALConcludeRegistration> {
    const invite = await this.mailHistoryService.findOne({ hash });
    if (!invite) {
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
          details: {
            invite: {
              hash: 'inviteHashNotFound',
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (invite.inviteStatus.id !== InviteStatusEnum.sent) {
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
          details: {
            invite: {
              inviteStatus: `inviteAlreadyUsed'`,
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
          error: HttpStatusMessage.UNAUTHORIZED,
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

    await this.mailHistoryService.update(
      invite.id,
      {
        inviteStatus: {
          id: InviteStatusEnum.used,
        },
      },
      'AuthLicenseeService.concludeRegistration()',
    );

    const updatedUser = await this.usersService.update(
      user.id,
      {
        password: registerDto.password,
        hash: hash,
        status: {
          id: StatusEnum.active,
        } as Status,
      },
      'AuthLicenseeService.concludeRegistration()',
    );

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
