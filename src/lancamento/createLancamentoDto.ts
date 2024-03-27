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
  valor: string;

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
  data_lancamento: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  algoritmo: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  glosa: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  recurso: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  valor_a_pagar: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  numero_processo: string;
  
  @ApiProperty()
  @IsNotEmpty()
  id_cliente_favorecido: number;
}
