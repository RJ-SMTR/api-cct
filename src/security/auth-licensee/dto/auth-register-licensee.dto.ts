import { ApiProperty } from '@nestjs/swagger';
import { MinLength } from 'class-validator';

export class AuthRegisterLicenseeDto {
  @ApiProperty({ example: 'secret' })
  @MinLength(6)
  password: string;
}
