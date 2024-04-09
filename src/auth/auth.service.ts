import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { plainToClass } from 'class-transformer';
import * as crypto from 'crypto';
import { ForgotService } from 'src/forgot/forgot.service';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { MailData } from 'src/mail/interfaces/mail-data.interface';
import { MailService } from 'src/mail/mail.service';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { SocialInterface } from 'src/social/interfaces/social.interface';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { UsersService } from 'src/users/users.service';
import { HttpStatusMessage } from 'src/utils/enums/http-error-message.enum';
import { logLog, logWarn } from 'src/utils/log-utils';
import { User } from '../users/entities/user.entity';
import { LoginResponseType } from '../utils/types/auth/login-response.type';
import { Nullable } from '../utils/types/nullable.type';
import { AuthProvidersEnum } from './auth-providers.enum';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { AuthResendEmailDto } from './dto/auth-resend-mail.dto';
import { AuthUpdateDto } from './dto/auth-update.dto';

@Injectable()
export class AuthService {
  private logger: Logger = new Logger('AuthService', { timestamp: true });

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private forgotService: ForgotService,
    private mailService: MailService,
    private mailHistoryService: MailHistoryService,
  ) { }

  async validateLogin(
    loginDto: AuthEmailLoginDto,
    onlyAdmin: boolean,
  ): Promise<LoginResponseType> {
    const user = await this.usersService.findOne({
      email: loginDto.email,
    });

    if (
      !user ||
      (user?.role &&
        !(
          onlyAdmin
            ? [
              RoleEnum.master,
              RoleEnum.admin,
              RoleEnum.aprovador_financeiro,
              RoleEnum.lancador_financeiro,
            ]
            : [RoleEnum.user]
        ).includes(user.role.id))
    ) {
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
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
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
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

  async validateSocialLogin(
    authProvider: string,
    socialData: SocialInterface,
  ): Promise<LoginResponseType> {
    let user: Nullable<User>;
    const socialEmail = socialData.email?.toLowerCase();

    const userByEmail = await this.usersService.findOne({
      email: socialEmail,
    });

    user = await this.usersService.findOne({
      socialId: socialData.id,
      provider: authProvider,
    });

    if (user) {
      if (socialEmail && !userByEmail) {
        user.email = socialEmail;
      }
      await this.usersService.update(
        user.id,
        user,
        'AuthService.validateSocialLogin()',
      );
    } else if (userByEmail) {
      user = userByEmail;
    } else {
      const role = plainToClass(Role, {
        id: RoleEnum.user,
      });
      const status = plainToClass(Status, {
        id: StatusEnum.active,
      });

      user = await this.usersService.create({
        email: socialEmail ?? null,
        firstName: socialData.firstName ?? null,
        lastName: socialData.lastName ?? null,
        socialId: socialData.id,
        provider: authProvider,
        role,
        status,
      });

      user = await this.usersService.findOne({
        id: user.id,
      });
    }

    if (!user) {
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
          details: {
            user: 'userNotFound',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const jwtToken = this.jwtService.sign({
      id: user.id,
      role: user.role,
    });

    return {
      token: jwtToken,
      user,
    };
  }

  async register(dto: AuthRegisterLoginDto): Promise<void | object> {
    let hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');
    while (await this.mailHistoryService.findOne({ hash })) {
      hash = crypto
        .createHash('sha256')
        .update(randomStringGenerator())
        .digest('hex');
    }

    await this.usersService.create({
      ...dto,
      email: dto.email,
      fullName: dto.fullName,
      role: {
        id: RoleEnum.user,
      } as Role,
      status: {
        id: StatusEnum.inactive,
      } as Status,
      hash,
    });

    const { mailConfirmationLink } =
      await this.mailService.sendConcludeRegistration({
        to: dto.email,
        data: {
          hash,
          userName: dto.fullName,
        },
      });

    return { link: mailConfirmationLink };
  }

  /**
   * @throws `HttpException`
   */
  private async getUser(id: number): Promise<User> {
    const user = await this.usersService.getOne({ id });
    if (!user || !user?.email || !user?.hash) {
      throw new HttpException(
        {
          error: {
            expectedUserId: id,
            user: {
              ...(!user ? { id: 'not found' } : {}),
              ...(user && !user.email ? { email: 'field is empty' } : {}),
              ...(user && !user.hash ? { hash: 'field is empty' } : {}),
            },
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return user;
  }

  /**
   * @throws `HttpException`
   */
  private async getMailHistory(user: User): Promise<MailHistory> {
    const invite = await this.mailHistoryService.findOne({
      user: { id: user.id },
    });
    if (!invite) {
      throw new HttpException(
        {
          error: 'invite not found',
          details: {
            userId: user.id,
          },
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return invite;
  }

  /**
   * @throws `HttpException`
   */
  async performSendRegisterEmail(
    user: User,
    userMailHistory: MailHistory,
    logContext: string,
  ) {
    const mailData: MailData<{ hash: string; to: string; userName: string }> = {
      to: user.email as string,
      data: {
        hash: userMailHistory.hash as string,
        to: user.email as string,
        userName: user.fullName as string,
      },
    };
    const mailResponse = await this.mailService.sendConcludeRegistration(
      mailData,
    );
    if (mailResponse.mailSentInfo.success === true) {
      userMailHistory.setInviteStatus(InviteStatusEnum.sent);
      userMailHistory.sentAt = new Date(Date.now());
      await this.mailHistoryService.update(
        userMailHistory.id,
        {
          inviteStatus: userMailHistory.inviteStatus,
          sentAt: userMailHistory.sentAt,
        },
        `AuthService.${logContext}`,
      );
      logLog(this.logger,
        `Email de cadastro enviado com sucesso (${userMailHistory.getLogInfoStr()})`,
        logContext);
    } else {
      throw new HttpException(
        {
          error: HttpStatus.INTERNAL_SERVER_ERROR,
          details: {
            mailResponse: mailResponse,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * @throws `HttpException`
   */
  async sendRegisterEmail(user: User, userMailHistory: MailHistory) {
    const THIS_METHOD = this.sendRegisterEmail.name;
    await this.performSendRegisterEmail(user, userMailHistory, THIS_METHOD);
  }

  async validateQuota(): Promise<number> {
    const quota = await this.mailHistoryService.getRemainingQuota();
    if (quota <= 0) {
      throw new HttpException(
        {
          error: 'no daily quota available to resend email',
          details: {
            remainingQuota: quota,
          },
        },
        HttpStatus.NOT_FOUND,
      );
    } else {
      return quota;
    }
  }

  /**
   * @throws `HttpException`
   */
  async resendRegisterMail(args: AuthResendEmailDto): Promise<void> {
    const THIS_METHOD = this.resendRegisterMail.name;
    const user = await this.getUser(args.id);
    const userMailHsitory = await this.getMailHistory(user);
    await this.validateQuota();
    await this.performSendRegisterEmail(user, userMailHsitory, THIS_METHOD);
  }

  async confirmEmail(hash: string): Promise<void> {
    const user = await this.usersService.findOne({
      hash,
    });

    if (!user) {
      throw new HttpException(
        {
          error: `notFound`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    user.hash = null;
    user.status = plainToClass(Status, {
      id: StatusEnum.active,
    });
    await user.save();
  }

  async forgotPassword(email: string): Promise<void | object> {
    await this.validateQuota();
    const user = await this.usersService.findOne({
      email,
    });

    const returnMessage = {
      info: 'if email exists, an email should be sent.',
    };

    if (!user) {
      logWarn(this.logger, `forgotPassword(): email '${email}' does not exists`);
      return returnMessage;
    }

    const hash = await this.forgotService.generateHash();

    await this.forgotService.create({
      hash,
      user,
    });

    try {
      const mailSentInfo = await this.mailService.sendForgotPassword({
        to: email,
        data: {
          hash,
        },
      });

      // Success
      if (mailSentInfo.success === true) {
        logLog(this.logger, 'Email redefinir senha enviado com sucesso.' +
          `\n    - Detalhes: ${JSON.stringify({ mailSentInfo })}`,
          'forgotPassword()');
        return returnMessage;
      }

      // SMTP error
      else {
        throw new HttpException(
          {
            error: HttpStatusMessage.INTERNAL_SERVER_ERROR,
            details: {
              mailSentInfo: mailSentInfo,
            },
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (httpException) {
      // API error
      throw httpException;
    }
  }

  async resetPassword(hash: string, password: string): Promise<void> {
    const forgot = await this.forgotService.findOne({
      where: {
        hash,
      },
    });

    if (!forgot) {
      throw new HttpException(
        {
          error: HttpStatusMessage.UNAUTHORIZED,
          details: {
            error: 'hash not found',
            hash,
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = forgot.user;
    user.password = password;

    await user.save();
    await this.forgotService.softDelete(forgot.id);
  }

  async me(user: User): Promise<Nullable<User>> {
    return this.usersService.findOne({
      id: user.id,
    });
  }

  async update(user: User, userDto: AuthUpdateDto): Promise<Nullable<User>> {
    const userProfile = await this.usersService.findOne({ id: user.id });

    if (!userProfile || !(userProfile && userProfile?.cpfCnpj)) {
      throw new HttpException(
        {
          details: {
            token: 'valid token but decoded user data is invalid',
            user: {
              ...(!userProfile?.id
                ? { id: user?.id }
                : { id: 'userNotExists' }),
              ...(!(userProfile && userProfile?.cpfCnpj) && {
                cpfCnpj: 'invalidCpfCnpj',
              }),
            },
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    userProfile.update(userDto);
    await this.usersService.update(
      user.id,
      userProfile,
      'AuthService.update()',
    );

    return userProfile;
  }

  async softDelete(user: User): Promise<void> {
    await this.usersService.softDelete(user.id, 'AuthService.softDelete()');
  }
}
