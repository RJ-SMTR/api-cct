import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class PagamentoRenovarNsaDto {
  @ApiProperty({ description: 'NSA do arquivo rejeitado pelo banco' })
  @IsInt()
  @Min(1)
  nsa: number;
}
