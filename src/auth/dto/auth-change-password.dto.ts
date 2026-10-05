import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches, MinLength } from 'class-validator';

export class AuthChangePasswordDto {
  @ApiProperty()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty()
  @IsNotEmpty()
  @MinLength(8, { message: 'A nova senha deve ter no mínimo 8 caracteres.' })
  @Matches(/[0-9]/, { message: 'A nova senha deve conter ao menos um número.' })
  @Matches(/[a-z]/, { message: 'A nova senha deve conter ao menos uma letra minúscula.' })
  @Matches(/[A-Z]/, { message: 'A nova senha deve conter ao menos uma letra maiúscula.' })
  newPassword: string;
}
