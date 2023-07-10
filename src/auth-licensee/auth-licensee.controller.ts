import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { AuthLicenseeService } from './auth-licensee.service';
import { AuthRegisterLicenseeDto } from './dto/auth-register-licensee.dto';
import { InviteHashExistsPipe } from 'src/invite/pipes/invite-hash-exists.pipe';
import { InviteApiParams } from 'src/invite/api-param/invite.api-param';
import { IsInvitePermitCodeRegisteredPipe } from 'src/invite/pipes/is-invite-permit-code-registered.pipe';

@ApiTags('Auth')
@Controller({
  path: 'auth/licensee',
  version: '1',
})
export class AuthLicenseeController {
  constructor(private authLicenseeService: AuthLicenseeService) {}

  @Post('invite/:hash')
  @HttpCode(HttpStatus.OK)
  @ApiParam(InviteApiParams.hash)
  async invite(
    @Param('hash', InviteHashExistsPipe, IsInvitePermitCodeRegisteredPipe)
    hash: string,
  ): Promise<void | object> {
    return await this.authLicenseeService.getInviteProfileByHash(hash);
  }

  @Post('register/:hash')
  @HttpCode(HttpStatus.OK)
  @ApiParam(InviteApiParams.hash)
  async register(
    @Param('hash', InviteHashExistsPipe, IsInvitePermitCodeRegisteredPipe)
    hash: string,
    @Body() data: AuthRegisterLicenseeDto,
  ): Promise<void | object> {
    return await this.authLicenseeService.register(data, hash);
  }
}
