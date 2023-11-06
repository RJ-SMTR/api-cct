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
import { AuthLicenseeService } from './auth-licensee.service';
import { AuthRegisterLicenseeDto } from './dto/auth-register-licensee.dto';
import { MailHistoryHashExistsPipe } from 'src/mail-history/pipes/mail-history-hash-exists.pipe';
import { MailHistoryApiParams } from 'src/mail-history/api-param/mail-history.api-param';
import { AuthLicenseeLoginDto } from './dto/auth-licensee-login.dto';
import { LoginResponseType } from 'src/utils/types/auth/login-response.type';

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
    return this.authLicenseeService.validateLogin(loginDto, false);
  }

  @Post('invite/:hash')
  @HttpCode(HttpStatus.OK)
  @ApiParam(MailHistoryApiParams.hash)
  async invite(
    @Param('hash', MailHistoryHashExistsPipe)
    hash: string,
  ): Promise<void | object> {
    return await this.authLicenseeService.getInviteProfile(hash);
  }

  @Post('register/:hash')
  @HttpCode(HttpStatus.OK)
  @ApiParam(MailHistoryApiParams.hash)
  async register(
    @Param('hash', MailHistoryHashExistsPipe)
    hash: string,
    @Body() data: AuthRegisterLicenseeDto,
  ): Promise<void | object> {
    return await this.authLicenseeService.concludeRegistration(data, hash);
  }
}
