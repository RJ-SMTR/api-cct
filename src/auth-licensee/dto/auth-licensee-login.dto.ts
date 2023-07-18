import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Validate } from 'class-validator';
import { IsExist } from 'src/utils/validators/is-exists.validator';

export class AuthLicenseeLoginDto {
  @ApiProperty({ example: '213890329890312' })
  @IsNotEmpty()
  @Validate(IsExist, ['User'], { message: 'permitCodeNotExists' })
  permitCode: string;

  @ApiProperty({ example: 'secret' })
  @IsNotEmpty()
  password: string;
}
