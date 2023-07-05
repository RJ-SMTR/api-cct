import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class AuthWhatsappConfirmDto {
  @ApiProperty({ example: '123456' })
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'test1@example.com' })
  @IsNotEmpty()
  email: string;
}
