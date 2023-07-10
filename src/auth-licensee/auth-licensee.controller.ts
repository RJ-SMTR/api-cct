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
import { BaseValidator } from 'src/utils/validators/base-validator';
import { InvitePermitCodeDto } from 'src/invite/dto/invite-permit-code.dto';
import { InviteApiParams } from 'src/invite/api-param/invite.api-param';

@ApiTags('Auth')
@Controller({
  path: 'auth/licensee',
  version: '1',
})
export class AuthLicenseeController {
  constructor(
    private authLicenseeService: AuthLicenseeService,
    private baseValidator: BaseValidator,
  ) {}

  @Post('invite/:hash')
  @HttpCode(HttpStatus.OK)
  @ApiParam(InviteApiParams.hash)
  async invite(
    @Param('hash', InviteHashExistsPipe) hash: string,
  ): Promise<void | object> {
    const ret = await this.authLicenseeService.getInviteProfileByHash(hash);
    return ret;
  }

  @Post('register/:hash')
  @HttpCode(HttpStatus.OK)
  @ApiParam(InviteApiParams.hash)
  async register(
    @Param('hash', InviteHashExistsPipe) hash: string,
    @Body() data: AuthRegisterLicenseeDto,
  ): Promise<void | object> {
    const invitePermitCodeDto: InvitePermitCodeDto = {
      hash: hash,
      permitCode: data.permitCode,
    };
    await this.baseValidator.validateOrReject(
      invitePermitCodeDto,
      InvitePermitCodeDto,
    );

    const ret = await this.authLicenseeService.register(data, hash);
    return ret;
  }
}
