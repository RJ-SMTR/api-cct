import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { plainToClass } from 'class-transformer';
import * as crypto from 'crypto';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { UpdateCoreBankInterface } from 'src/core-bank/interfaces/update-core-bank.interface';
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
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { User } from '../users/entities/user.entity';
import { LoginResponseType } from '../utils/types/auth/login-response.type';
import { NullableType } from '../utils/types/nullable.type';
import { AuthProvidersEnum } from './auth-providers.enum';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { AuthResendEmailDto } from './dto/auth-resend-mail.dto';
import { AuthUpdateDto } from './dto/auth-update.dto';
import { ConfigService } from '@nestjs/config';
import { MailSentInfo } from 'src/mail/interfaces/mail-sent-info.interface';
import { IResendAllResponse } from './interfaces/resend-all-response.interface';

@Injectable()
export class AuthService {
  private logger: Logger = new Logger('AuthService', { timestamp: true });

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private forgotService: ForgotService,
    private mailService: MailService,
    private coreBankService: CoreBankService,
    private mailHistoryService: MailHistoryService,
    private configService: ConfigService,
  ) {}

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

  async validateSocialLogin(
    authProvider: string,
    socialData: SocialInterface,
  ): Promise<LoginResponseType> {
    let user: NullableType<User>;
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
      await this.usersService.update(user.id, user);
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
          error: HttpErrorMessages.UNAUTHORIZED,
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
      await this.mailService.userConcludeRegistration({
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
   * Try to resend register email.
   *
   * If success, update mail status ant other properties.
   *
   * If error, throw exception.
   *
   * @throws `HttpException`
   */
  async resendRegisterEmail(user: User, userMail: MailHistory) {
    const mailData: MailData<{ hash: string; to: string; userName: string }> = {
      to: user.email as string,
      data: {
        hash: userMail.hash as string,
        to: user.email as string,
        userName: user.fullName as string,
      },
    };

    // Throws HttpException if needed
    const mailResponse = await this.mailService.userConcludeRegistration(
      mailData,
    );

    // Success
    if (mailResponse.mailSentInfo.success === true) {
      const newUserMail = new MailHistory(userMail);
      newUserMail.setInviteError({
        httpErrorCode: null,
        smtpErrorCode: null,
      });
      if (newUserMail.getMailStatus() == InviteStatusEnum.queued) {
        newUserMail.setInviteStatus(InviteStatusEnum.sent);
      } else {
        newUserMail.setInviteStatus(InviteStatusEnum.resent);
      }
      newUserMail.sentAt = new Date(Date.now());
      newUserMail.failedAt = null;
      await this.mailHistoryService.update(newUserMail.id, newUserMail);
      this.logger.log(
        `sendRegisterEmail(): register email sent successfully (${JSON.stringify(
          {
            email: newUserMail.email,
            inviteStatus: newUserMail.inviteStatus,
          },
        )})`,
      );
    }

    // SMTP error
    else {
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
  async resendRegisterMail(args: AuthResendEmailDto): Promise<void> {
    const user = await this.getUser(args.id);
    const userMailHsitory = await this.getMailHistory(user);
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
    }
    await this.resendRegisterEmail(user, userMailHsitory);
  }

  /**
   * Resend all register mails within remaining daily quota.
   * @throws `HttpException`
   */
  async resendAllRegisterMails(): Promise<IResendAllResponse> {
    const dailyQuota = () => this.configService.getOrThrow('mail.dailyQuota');
    const quota = await this.mailHistoryService.getRemainingQuota();
    const notUsedMails = await this.mailHistoryService.findNotUsed();
    const resendMails = notUsedMails.slice(0, quota);
    const mailsToResendStr = `${resendMails.length}/${notUsedMails.length}`;
    const remainingQuotaStr = `${quota}/${dailyQuota()}`;

    if (quota <= 0) {
      throw new HttpException(
        {
          error: 'Não há quota diária para reenviar emails!',
          details: {
            remainingQuota: remainingQuotaStr,
            mailsToResend: mailsToResendStr,
          },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (resendMails.length === 0) {
      throw new HttpException(
        {
          error:
            'Não há emails para enviar! (emails com status diferente de USED)',
          details: {
            remainingQuota: remainingQuotaStr,
            mailsToResend: mailsToResendStr,
          },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    this.logger.log(
      `resending all mails within remaining quota. ` +
        `(quota: ${remainingQuotaStr}, sending: ${mailsToResendStr})`,
    );

    const response: IResendAllResponse = {
      total: resendMails.length,
      sent: 0,
      failed: 0,
      sentMailData: [],
      failedMailData: [],
    };

    for (const mailHistory of resendMails) {
      const newMailHistory = new MailHistory(mailHistory);
      const user = mailHistory.user;
      this.usersService;

      // Success
      try {
        await this.resendRegisterEmail(user, mailHistory);
        response.sentMailData.push({
          id: newMailHistory.id,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
          },
        });
      } catch (httpException) {
        // Error
        response.failedMailData.push({
          id: newMailHistory.id,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
          },
        });

        // SMTP error
        if (httpException?.details?.mailResponse) {
          const mailSentInfo = httpException.details.mailResponse
            .mailSentInfo as MailSentInfo;
          this.logger.error(
            'resendAllRegisterMail(): mail sent returned error' +
              '\n    - Message: ' +
              JSON.stringify(mailSentInfo) +
              '\n    - Traceback:\n' +
              new Error().stack,
          );
          newMailHistory.sentAt = null;
          newMailHistory.failedAt = new Date(Date.now());
          newMailHistory.setInviteError({
            httpErrorCode: HttpStatus.INTERNAL_SERVER_ERROR,
            smtpErrorCode: mailSentInfo.response.code,
          });
          await this.mailHistoryService.update(
            newMailHistory.id,
            newMailHistory,
          );
        }

        // API error
        else {
          this.logger.error(
            'resendAllRegisterMail(): mail failed to send' +
              '\n    - Message: ' +
              JSON.stringify(httpException) +
              '\n    - Traceback:\n' +
              (httpException as Error).stack,
          );
          newMailHistory.sentAt = null;
          newMailHistory.failedAt = new Date(Date.now());
          newMailHistory.setInviteError({
            httpErrorCode: HttpStatus.INTERNAL_SERVER_ERROR,
            smtpErrorCode: null,
          });
          await this.mailHistoryService.update(
            newMailHistory.id,
            newMailHistory,
          );
        }
      }
    }

    response.sent = response.sentMailData.length;
    response.failed = response.failedMailData.length;
    return response;
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
    const user = await this.usersService.findOne({
      email,
    });

    const returnMessage = {
      info: 'if email exists, an email should be sent.',
    };

    if (!user) {
      this.logger.warn(`forgotPassword(): email '${email}' does not exists`);
      return returnMessage;
    }

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

    await this.forgotService.create({
      hash,
      user,
    });

    await this.mailService.forgotPassword({
      to: email,
      data: {
        hash,
      },
    });

    return returnMessage;
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
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            hash: `notFound`,
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

  async me(user: User): Promise<NullableType<User>> {
    return this.usersService.findOne({
      id: user.id,
    });
  }

  async update(
    user: User,
    userDto: AuthUpdateDto,
  ): Promise<NullableType<User>> {
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
    await this.usersService.update(user.id, userProfile);

    const coreBankProfile: UpdateCoreBankInterface = {
      bankAccountCode: userProfile.bankAccount,
      bankAccountDigit: userProfile.bankAccountDigit,
      bankAgencyCode: userProfile.bankAgency,
      bankCode: userProfile.bankCode,
    };
    this.coreBankService.update(userProfile.cpfCnpj, coreBankProfile);

    return userProfile;
  }

  async softDelete(user: User): Promise<void> {
    await this.usersService.softDelete(user.id);
  }
}
