import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class LancamentoDeleteDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ maxLength: 150 })
  @IsNotEmpty()
  @IsString()
  @Length(1, 150)
  motivo_cancelamento: string;
}
