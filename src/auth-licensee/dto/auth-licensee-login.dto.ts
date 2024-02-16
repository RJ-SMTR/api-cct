import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Validate } from 'class-validator';
import { customValidationOptions } from 'src/utils/all-exteptions-filter/custom-validation-options';
import { HttpStatusMessage } from 'src/utils/enums/http-error-message.enum';
import { IsExist } from 'src/utils/validators/is-exists.validator';

export class AuthLicenseeLoginDto {
  @ApiProperty({ example: '213890329890312' })
  @IsNotEmpty()
  @Validate(
    IsExist,
    ['User'],
    customValidationOptions({
      statusCode: HttpStatus.UNAUTHORIZED,
      message: HttpStatusMessage.UNAUTHORIZED,
      details: 'permitCodeNotExists',
    }),
  )
  permitCode: string;

  @ApiProperty({ example: 'secret' })
  @IsNotEmpty()
  password: string;
}
