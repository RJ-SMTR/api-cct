import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Matches } from 'class-validator';

export class SincronizarOrdensPeriodoDto {
  @ApiProperty({ description: 'Primeira data de captura (YYYY-MM-DD)', example: '2026-10-09' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataInicio deve estar no formato YYYY-MM-DD' })
  dataInicio: string;

  @ApiProperty({ description: 'Última data de captura (YYYY-MM-DD)', example: '2026-10-12' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataFim deve estar no formato YYYY-MM-DD' })
  dataFim: string;

  @ApiPropertyOptional({ description: 'Consórcios/modais a sincronizar. Omitido = os mesmos do cron.', type: String, isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  consorcios?: string[];
}
