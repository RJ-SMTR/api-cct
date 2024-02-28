import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsDateString,
} from 'class-validator';

export class CreateLancamentoDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  descricao: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  valor: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  data_ordem: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  data_pgto: Date;
}
