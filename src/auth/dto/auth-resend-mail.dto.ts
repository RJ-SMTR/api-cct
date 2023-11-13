import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class AuthResendEmailDto {
  @ApiProperty({ example: 3 })
  @IsNotEmpty()
  id: number;
}
