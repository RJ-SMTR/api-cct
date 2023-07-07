import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength, Validate } from 'class-validator';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';

export class AuthRegisterLicenseeDto {
  @ApiProperty({ example: 'secret' })
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '213890329890312' })
  @IsNotEmpty()
  @Validate(IsNotExist, ['User'], {
    message: 'permitCodeAlreadyRegistered',
  })
  permitCode: string;
}
