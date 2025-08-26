import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class PendentesQueryDTO {
  @ApiProperty({ description: 'Data da Ordem de Pagamento Inicial', required: true })
  @Type(() => Date)
  @IsDate()
  dataInicio: Date;

  @ApiProperty({ description: 'Data da Ordem de Pagamento Final', required: true })
  @Type(() => Date)
  @IsDate()
  dataFim: Date;

  //Async remessaPendenteExec(dtInicio: string, dtFim: string, dataPagamento?: string, idOperadoras?: string[]) {
  //
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
  IdOperadoras?: number[];



}

