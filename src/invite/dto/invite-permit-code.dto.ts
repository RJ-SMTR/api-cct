import { ApiProperty } from '@nestjs/swagger';
import { HasInvitePermitCode } from '../validators/has-invite-permit-code.validator';

export class InvitePermitCodeDto {
  hash: string;

  @ApiProperty({ example: '213890329890312' })
  @HasInvitePermitCode('hash')
  permitCode: string;
}
