import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthProvidersEnum } from 'src/auth/auth-providers.enum';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { MailService } from 'src/mail/mail.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { UsersService } from 'src/users/users.service';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { LoginResponseType } from 'src/utils/types/auth/login-response.type';
import { BaseValidator } from 'src/utils/validators/base-validator';
import { AuthLicenseeLoginDto } from './dto/auth-licensee-login.dto';
import { AuthRegisterLicenseeDto } from './dto/auth-register-licensee.dto';
import { IALConcludeRegistration } from './interfaces/al-conclude-registration.interface';
import { IALInviteProfile } from './interfaces/al-invite-profile.interface';

@Injectable()
export class AuthLicenseeService {
  private logger: Logger = new Logger('AuthLicenseeService', {
    timestamp: true,
  });

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private mailHistoryService: MailHistoryService,
    private baseValidator: BaseValidator,
    private mailService: MailService,
  ) { }

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

    if (
      user?.status?.id === undefined ||
      user?.status?.id !== StatusEnum.active
    ) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
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

  async getInviteProfile(hash: string): Promise<IALInviteProfile> {
    const invite = await this.mailHistoryService.getOne({ hash });

    if (invite.inviteStatus.id !== InviteStatusEnum.sent) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
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
      user.id !== invite.user.id
      || !user.permitCode || !user.fullName || !user.email
    ) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
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
          error: HttpErrorMessages.UNAUTHORIZED,
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
          error: HttpErrorMessages.UNAUTHORIZED,
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
