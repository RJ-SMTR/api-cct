import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
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
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  fullName?: string;

  @ApiProperty({ example: '213890329890312' })
  @IsNotEmpty()
  permissionCode?: string;

  @ApiProperty({ example: '16322676313' })
  @IsNotEmpty()
  cpf?: string;

  @ApiProperty({ example: '6352' })
  @IsNotEmpty()
  @MaxLength(4)
  agency?: string;

  @ApiProperty({ example: '17263731' })
  @IsNotEmpty()
  bankAccount?: string;

  @ApiProperty({ example: '2' })
  @IsNotEmpty()
  bankAccountDigit?: string;

  @ApiProperty()
  phone?: string;
}
