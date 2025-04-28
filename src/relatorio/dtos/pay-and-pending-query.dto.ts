import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class PayAndPendingQueryDto {
  @ApiProperty({ description: 'Data da Ordem de Pagamento Inicial', required: true })
  @Type(() => Date)
  @IsDate()
  dataInicio: Date;

  @ApiProperty({ description: 'Data da Ordem de Pagamento Final', required: true })
  @Type(() => Date)
  @IsDate()
  dataFim: Date;

  @ApiPropertyOptional({
    description: 'Pesquisa o nome parcial dos consórcios, sem distinção de acento ou maiúsculas. Para STPC/STPL, agrupa todos os vanzeiros sob o consórcio.',
    type: String,
    isArray: true,
    required: false,
    example: ['VLT', 'Internorte'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',');
    }
    return value;
  })
  consorcioNome?: string[];


  @ApiPropertyOptional({
    description: 'Pesquisa todos os vanzeiros.', default: false
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  todosVanzeiros?: boolean;


  @ApiPropertyOptional({
    description: 'Pesquisa o id dos usuários.',
    type: String,
    isArray: true,
    required: false,
    example: ['123'],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((val) => parseInt(val, 10));
    }
    if (typeof value === 'string') {
      return value.split(',').map((val) => parseInt(val, 10));
    }
    return value;
  })
  userIds?: number[];

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

  @ApiPropertyOptional({ description: 'Se o status de erro for Erro de Pagamento', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  erro?: boolean;

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

