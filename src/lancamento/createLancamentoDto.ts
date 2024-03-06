import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsDateString } from 'class-validator';

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

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  algoritmo: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  glosa: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  recurso: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  valor_a_pagar: number;
  
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  numero_processo: number;
}
