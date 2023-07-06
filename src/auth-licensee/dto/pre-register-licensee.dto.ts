import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Validate } from 'class-validator';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';

export class PreRegisterLicenseeDto {
  @ApiProperty({ example: '213890329890312' })
  @IsNotEmpty()
  @Validate(IsNotExist, ['User'], {
    message: 'licenseeAlreadyRegistered',
  })
  permitCode: string;
}
