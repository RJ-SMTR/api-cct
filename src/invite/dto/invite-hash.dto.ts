import { ApiProperty } from '@nestjs/swagger';
import { InviteHashExists } from '../validators/invite-hash-exists.validator';

export class InviteHashDto {
  @ApiProperty({ example: '1B374080D46868E2D838DB0F98890902' })
  @InviteHashExists()
  hash: string;
}
