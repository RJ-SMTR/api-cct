import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { CONTAS, ContaDashboard, SITUACOES, SituacaoDashboard } from '../service/dashboard-pagamentos.utils';

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export class DashboardPagamentosResumoQueryDto {
  @ApiProperty({ description: 'Primeira data de pagamento (YYYY-MM-DD)', example: '2026-09-01' })
  @Matches(DATA_ISO, { message: 'dataInicio deve estar no formato YYYY-MM-DD' })
  dataInicio: string;

  @ApiProperty({ description: 'Última data de pagamento (YYYY-MM-DD)', example: '2026-09-30' })
  @Matches(DATA_ISO, { message: 'dataFim deve estar no formato YYYY-MM-DD' })
  dataFim: string;
}

export class DashboardPagamentosDetalheQueryDto extends DashboardPagamentosResumoQueryDto {
  @ApiProperty({ enum: CONTAS })
  @IsIn(CONTAS)
  conta: ContaDashboard;

  @ApiPropertyOptional({ description: 'Consórcio, modal ou grupo (ex.: VLT, STPL, Guardador, Pagamento único)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  grupo?: string;

  @ApiPropertyOptional({ enum: SITUACOES })
  @IsOptional()
  @IsIn(SITUACOES)
  situacao?: SituacaoDashboard;

  @ApiPropertyOptional({ description: 'Código do motivo (ocorrência do banco ou etapa), como devolvido no resumo' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  motivo?: string;

  @ApiPropertyOptional({ description: 'Favorecido: parte do nome ou do CPF/CNPJ (mínimo 2 caracteres)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busca?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
