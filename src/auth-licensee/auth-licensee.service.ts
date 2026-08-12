import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthProvidersEnum } from 'src/auth/domain/enums/auth-providers.enum';
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
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';

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

  private isRegistrationConcluded(user: User | null | undefined): boolean {
    return user?.status?.id === StatusEnum.active;
  }

  private async markInviteAsUsed(
    invite: MailHistory,
    logContext: string,
  ): Promise<void> {
    if (invite.inviteStatus.id === InviteStatusEnum.used) {
      return;
    }

    await this.mailHistoryService.update(
      invite.id,
      {
        inviteStatus: {
          id: InviteStatusEnum.used,
        },
      },
      logContext,
    );
    invite.inviteStatus.id = InviteStatusEnum.used;
    invite.inviteStatus.name = 'used';
  }

  private getLoginRedirectTo(roleId?: number | null): string {
    return roleId === RoleEnum.agentes
      ? '/agentes/sign-in'
      : '/sign-in';
  }

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
    const user = await this.usersService.getOne({ id: invite.user.id });

    if (this.isRegistrationConcluded(user)) {
      await this.markInviteAsUsed(
        invite,
        'AuthLicenseeService.getInviteProfile()',
      );
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

    if (
      invite.inviteStatus.id !== InviteStatusEnum.sent &&
      invite.inviteStatus.id !== InviteStatusEnum.used
    ) {
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

    await this.markInviteAsUsed(invite, 'AuthLicenseeService.getInviteProfile()');

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
      cpfCnpj: user.cpfCnpj,
      hash: invite.hash,
      inviteStatus: invite.inviteStatus,
      roleId: user.role?.id ?? null,
      redirectTo: this.getLoginRedirectTo(user.role?.id),
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

    const user = await this.usersService.getOne({ id: invite.user.id });

    if (this.isRegistrationConcluded(user)) {
      await this.markInviteAsUsed(
        invite,
        'AuthLicenseeService.concludeRegistration()',
      );
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

    if (
      invite.inviteStatus.id !== InviteStatusEnum.sent &&
      invite.inviteStatus.id !== InviteStatusEnum.used
    ) {
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

    await this.markInviteAsUsed(
      invite,
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
      roleId: updatedUser.role?.id ?? null,
      redirectTo: this.getLoginRedirectTo(updatedUser.role?.id),
    };
  }
}
