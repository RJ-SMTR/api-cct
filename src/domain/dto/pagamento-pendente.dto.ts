import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray,  IsDate,  IsOptional } from 'class-validator';

export class PendentesQueryDTO {
  @ApiProperty({ description: 'Data da Ordem de Pagamento Inicial', required: true })
  @Type(() => Date)
  @IsDate()
  dataInicio: Date;

  @ApiProperty({ description: 'Data da Ordem de Pagamento Final', required: true })
  @Type(() => Date)
  @IsDate()
  dataFim: Date;

  @ApiProperty({ description: 'Data de Pagamento', required: true })
  @Type(() => Date)
  @IsDate()
  dataPagamento: Date;


  @ApiPropertyOptional({
    description: 'Array de idOperadoras',
    type: String,
    isArray: true,
    required: false,
    example: ['123'],
  })
  @IsOptional()
  @IsArray()
  IdOperadoras?: string[];
}

