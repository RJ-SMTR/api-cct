import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  Post,
  Request,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { User } from '../users/entities/user.entity';
import { LoginResponseType } from '../utils/types/auth/login-response.type';
import { Nullable } from '../utils/types/nullable.type';
import { AuthService } from './auth.service';
import { AuthConfirmEmailDto } from './dto/auth-confirm-email.dto';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthForgotPasswordDto } from './dto/auth-forgot-password.dto';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { AuthResendEmailDto } from './dto/auth-resend-mail.dto';
import { AuthResetPasswordDto } from './dto/auth-reset-password.dto';
import { AuthUpdateDto } from './dto/auth-update.dto';

@ApiTags('Auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  private logger: Logger = new Logger('AuthController', { timestamp: true });

  constructor(
    private readonly authService: AuthService,
    private readonly mailHistoryService: MailHistoryService,
  ) {}

  @SerializeOptions({
    groups: ['me'],
  })
  @Post('email/login')
  @HttpCode(HttpStatus.OK)
  public login(
    @Body() loginDto: AuthEmailLoginDto,
  ): Promise<LoginResponseType> {
    return this.authService.validateLogin(loginDto, false);
  }

  @SerializeOptions({
    groups: ['me'],
  })
  @Post('admin/email/login')
  @HttpCode(HttpStatus.OK)
  public adminLogin(
    @Body() loginDTO: AuthEmailLoginDto,
  ): Promise<LoginResponseType> {
    return this.authService.validateLogin(loginDTO, true);
  }

  @SerializeOptions({
    groups: ['me'],
  })
  @Post('finan/email/login')
  @HttpCode(HttpStatus.OK)
  public finanLogin(
    @Body() loginDTO: AuthEmailLoginDto,
  ): Promise<LoginResponseType> {
    return this.authService.validateLogin(loginDTO, true);
  }

  @Post('email/register')
  @HttpCode(HttpStatus.OK)
  async register(
    @Body() createUserDto: AuthRegisterLoginDto,
  ): Promise<void | object> {
    return await this.authService.register(createUserDto);
  }

  @Post('email/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmEmail(
    @Body() confirmEmailDto: AuthConfirmEmailDto,
  ): Promise<void> {
    return this.authService.confirmEmail(confirmEmailDto.hash);
  }

  @ApiBearerAuth()
  @SerializeOptions({
    groups: ['admin'],
  })
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('email/resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendRegisterMail(
    @Body() resendEmailDto: AuthResendEmailDto,
  ): Promise<void> {
    return this.authService.resendRegisterMail(resendEmailDto);
  }

  @Post('forgot/password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body() forgotPasswordDto: AuthForgotPasswordDto,
  ): Promise<void | object> {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() resetPasswordDto: AuthResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(
      resetPasswordDto.hash,
      resetPasswordDto.password,
    );
  }

  @ApiBearerAuth()
  @SerializeOptions({
    groups: ['me'],
  })
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  public me(@Request() request): Promise<Nullable<User>> {
    return this.authService.me(request.user);
  }

  @ApiBearerAuth()
  @SerializeOptions({
    groups: ['me'],
  })
  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  public update(
    @Request() request,
    @Body() userDto: AuthUpdateDto,
  ): Promise<Nullable<User>> {
    return this.authService.update(request.user, userDto);
  }
}
