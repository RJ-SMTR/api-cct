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
import { InviteHashExistsPipe } from 'src/invite/pipes/invite-hash-exists.pipe';
import { InviteApiParams } from 'src/invite/api-param/invite.api-param';
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
  @ApiParam(InviteApiParams.hash)
  async invite(
    @Param('hash', InviteHashExistsPipe)
    hash: string,
  ): Promise<void | object> {
    return await this.authLicenseeService.getProfileByHash(hash);
  }

  @Post('register/:hash')
  @HttpCode(HttpStatus.OK)
  @ApiParam(InviteApiParams.hash)
  async register(
    @Param('hash', InviteHashExistsPipe)
    hash: string,
    @Body() data: AuthRegisterLicenseeDto,
  ): Promise<void | object> {
    return await this.authLicenseeService.register(data, hash);
  }
}
