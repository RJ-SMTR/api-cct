import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsNumber, IsOptional, IsString } from 'class-validator';

export class DetalhadoQueryDto {
  @ApiProperty({ description: 'Data da Ordem de Pagamento Inicial', required: true })
  @Type(() => Date)
  @IsDate()
  dataInicio: Date;

  @ApiProperty({ description: 'Data da Ordem de Pagamento Final', required: true })
  @Type(() => Date)
  @IsDate()
  dataFim: Date;

  @ApiPropertyOptional({ description: 'Pesquisa o nome parcial dos consórcios', type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  consorcioNome?: string[];

  @ApiPropertyOptional({ description: 'Somatório do valor bruto', type: Number })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  valorMin?: number;

  @ApiPropertyOptional({ description: 'Somatório do valor bruto', type: Number })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  valorMax?: number;

  @ApiPropertyOptional({ description: 'Se o pagamento foi pago com sucesso', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  pago?: boolean;

  @ApiPropertyOptional({ description: 'Se o status de erro for Estorno', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  estorno?: boolean;

  @ApiPropertyOptional({ description: 'Se o status de erro for Rejeitado', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  rejeitado?: boolean;
}

