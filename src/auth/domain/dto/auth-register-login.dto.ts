import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MinLength, Validate } from 'class-validator';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { Transform } from 'class-transformer';
import { lowerCaseTransformer } from 'src/utils/transformers/lower-case.transformer';

export class AuthRegisterLoginDto {
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

  @ApiProperty({ example: 'John' })
  firstName?: string;

  @ApiProperty({ example: 'Doe' })
  lastName?: string;

  @ApiProperty({ example: 'John' })
  fullName: string;

  @ApiProperty({ example: '213890329890312' })
  permitCode?: string;

  @ApiProperty({ example: '16322676313' })
  cpf?: string;

  @ApiProperty({ example: '6352' })
  agency?: string;

  @ApiProperty({ example: '17263731' })
  bankAccount?: string;

  @ApiProperty({ example: '2' })
  bankAccountDigit?: string;

  @ApiProperty({ example: '(21)91234-5678' })
  phone?: string;
}
