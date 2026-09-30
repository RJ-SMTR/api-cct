import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class PagamentoConsorcioValorBiDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  novoValor: number;

  @ApiProperty()
  @IsNotEmpty()
  senha: string;
}
