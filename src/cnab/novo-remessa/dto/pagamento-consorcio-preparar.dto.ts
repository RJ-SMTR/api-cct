import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional } from 'class-validator';

export class PagamentoConsorcioPrepararDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  dataInicio: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  dataFim: string;

  /** Só usado por Modais: agrupa por "valorGratuidade" (pagador CETT) em vez do fluxo normal. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  gratuidade?: boolean;
}
