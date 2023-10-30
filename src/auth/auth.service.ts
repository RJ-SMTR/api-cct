import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthUpdateDto } from './dto/auth-update.dto';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { RoleEnum } from 'src/roles/roles.enum';
import { StatusEnum } from 'src/statuses/statuses.enum';
import * as crypto from 'crypto';
import { plainToClass } from 'class-transformer';
import { Status } from 'src/statuses/entities/status.entity';
import { Role } from 'src/roles/entities/role.entity';
import { AuthProvidersEnum } from './auth-providers.enum';
import { SocialInterface } from 'src/social/interfaces/social.interface';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { UsersService } from 'src/users/users.service';
import { ForgotService } from 'src/forgot/forgot.service';
import { MailService } from 'src/mail/mail.service';
import { NullableType } from '../utils/types/nullable.type';
import { LoginResponseType } from '../utils/types/auth/login-response.type';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { UpdateCoreBankInterface } from 'src/core-bank/interfaces/update-core-bank.interface';
import { MailData } from 'src/mail/interfaces/mail-data.interface';
import { AuthResendEmailDto } from './dto/auth-resend-mail.dto';
import { InviteService } from 'src/invite/invite.service';

@Injectable()
export class AuthService {
  private logger: Logger = new Logger('AuthService', { timestamp: true });

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private forgotService: ForgotService,
    private mailService: MailService,
    private coreBankService: CoreBankService,
    private inviteService: InviteService,
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
    while (this.inviteService.findByHash(hash)) {
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

  async resendRegisterMail(obj: AuthResendEmailDto): Promise<void> {
    if (!obj) {
      throw new HttpException(
        {
          error: HttpErrorMessages.USER_NOT_FOUND,
          details: {
            error: `user not found`,
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.usersService.findOne({
      id: obj.id,
    });

    if (!user) {
      throw new HttpException(
        {
          error: HttpErrorMessages.USER_NOT_FOUND,
          details: {
            error: `User not found`,
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    await user.save();
    if (user.hash && user.email && user.hash) {
      const mailData: MailData<{ hash: string; to: string; userName: string }> =
        {
          to: user.email,
          data: {
            hash: user.hash,
            to: user.email,
            userName: user.fullName as string,
          },
        };
      await this.mailService.userConcludeRegistration(mailData);
    }
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
    while (this.inviteService.findByHash(hash)) {
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
            ...(!userProfile && { id: 'userNotExists' }),
            ...(!(userProfile && userProfile?.cpfCnpj) && {
              cpfCnpj: 'invalidCpfCnpj',
            }),
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.usersService.update(user.id, userDto);
    const newUserProfile = await this.usersService.findOne({
      id: user.id,
    });
    if (!newUserProfile) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          detail: 'updatedUserNotFound',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const coreBankProfile: UpdateCoreBankInterface = {
      bankAccountCode: newUserProfile.bankAccount,
      bankAccountDigit: newUserProfile.bankAccountDigit,
      bankAgencyCode: newUserProfile.bankAgency,
      bankCode: newUserProfile.bankCode,
    };
    this.coreBankService.update(userProfile.cpfCnpj, coreBankProfile);

    return newUserProfile;
  }

  async softDelete(user: User): Promise<void> {
    await this.usersService.softDelete(user.id);
  }
}
