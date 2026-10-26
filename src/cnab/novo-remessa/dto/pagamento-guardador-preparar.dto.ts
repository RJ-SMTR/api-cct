import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';
import { PagamentoConsorcioPrepararDto } from './pagamento-consorcio-preparar.dto';

export class PagamentoGuardadorPrepararDto extends PagamentoConsorcioPrepararDto {
  /** Liga o desconto dos pagamentos indevidos (tabela pagamento_indevido) no valor da remessa. Sem informar, não desconta. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  descontarIndevido?: boolean;

  /** Máximo, em R$, que pode ser descontado de cada indevido nesta remessa (padrão 100). */
  @ApiProperty({ required: false, default: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valorDescontoIndevido?: number;
}
