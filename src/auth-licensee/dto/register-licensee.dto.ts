import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { lowerCaseTransformer } from 'src/utils/transformers/lower-case.transformer';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';

export class AuthRegisterLicenseeDto {
  @ApiProperty({ example: 'secret' })
  @Transform(lowerCaseTransformer)
  @Validate(IsNotExist, ['User'], {
    message: 'emailAlreadyExists',
  })
  @ApiProperty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '213890329890312' })
  @IsNotEmpty()
  @Validate(IsNotExist, ['User'], {
    message: 'licenseeAlreadyRegistered',
  })
  permitCode: string;
}
