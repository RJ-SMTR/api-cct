import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Validate } from 'class-validator';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { lowerCaseTransformer } from 'src/utils/transformers/lower-case.transformer';

export class CreateFileUserDto {
  @ApiProperty({ example: 'test1@example.com' })
  @IsNotEmpty()
  @IsEmail()
  @Transform(lowerCaseTransformer)
  @Validate(IsNotExist, ['User'], {
    message: 'emailAlreadyExists',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123.456-7' })
  @IsString()
  @IsNotEmpty()
  @Validate(IsNotExist, ['User', { ignoreBlankOrNull: true }], {
    message: 'permitCode already exists',
  })
  permitCode: string;
}
