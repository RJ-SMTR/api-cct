import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  MinLength,
  Validate,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { lowerCaseTransformer } from 'src/utils/transformers/lower-case.transformer';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { IsPhoneBr } from '../validators/is-phone.validator';

export class AuthRegisterLicenseeDto {
  @ApiProperty({ example: 'test1@example.com' })
  @Transform(lowerCaseTransformer)
  @Validate(IsNotExist, ['User'], {
    message: 'emailAlreadyExists',
  })
  @IsEmail()
  email: string;

  @ApiProperty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '213890329890312' })
  @IsNotEmpty()
  licensee: string;

  @ApiProperty({ example: '5521912345678' })
  @IsNotEmpty()
  @IsNumberString()
  @IsPhoneBr({ countryCode: true, stateCode: true, mobileDigit: true })
  phone: string;
}
