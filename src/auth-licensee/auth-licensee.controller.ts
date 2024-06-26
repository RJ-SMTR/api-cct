import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  SerializeOptions,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { MailHistoryApiParams } from 'src/mail-history/api-param/mail-history.api-param';
import { MailHistoryValidationPipe } from 'src/mail-history/pipes/mail-history-validation.pipe';
import { LoginResponseType } from 'src/utils/types/auth/login-response.type';
import { AuthLicenseeService } from './auth-licensee.service';
import { AuthLicenseeLoginDto } from './dto/auth-licensee-login.dto';
import { AuthRegisterLicenseeDto } from './dto/auth-register-licensee.dto';
import { IALConcludeRegistration } from './interfaces/al-conclude-registration.interface';
import { IALInviteProfile } from './interfaces/al-invite-profile.interface';
import { RoleEnum } from 'src/roles/roles.enum';

@ApiTags('Auth')
@Controller({
  path: 'auth/licensee',
  version: '1',
})
export class AuthLicenseeController {
  constructor(private authLicenseeService: AuthLicenseeService) {}

  @SerializeOptions({
    groups: ['me'],
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  public login(
    @Body()
    loginDto: AuthLicenseeLoginDto,
  ): Promise<LoginResponseType> {
    return this.authLicenseeService.validateLogin(loginDto, RoleEnum.user);
  }

  @Post('invite/:hash')
  @HttpCode(HttpStatus.OK)
  @ApiParam(MailHistoryApiParams.hash)
  async postInviteHash(
    @Param('hash', MailHistoryValidationPipe)
    hash: string,
  ): Promise<IALInviteProfile> {
    return await this.authLicenseeService.getInviteProfile(hash);
  }

  @Post('register/:hash')
  @HttpCode(HttpStatus.OK)
  @ApiParam(MailHistoryApiParams.hash)
  async register(
    @Param('hash', MailHistoryValidationPipe)
    hash: string,
    @Body() data: AuthRegisterLicenseeDto,
  ): Promise<IALConcludeRegistration> {
    return await this.authLicenseeService.concludeRegistration(data, hash);
  }
}
