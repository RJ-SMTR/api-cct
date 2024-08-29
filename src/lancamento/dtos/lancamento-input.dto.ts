import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { User } from 'src/users/entities/user.entity';
import { DeepPartial } from 'typeorm';

export class LancamentoInputDto {
  constructor(dto?: DeepPartial<LancamentoInputDto>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  descricao: string;

  @ApiProperty({ type: Number, example: 1.99 })
  @IsNumber()
  valor: number;

  @ApiProperty({ type: 'DATE', example: '2024-08-01T19:54:56.299Z' })
  @IsDateString()
  data_ordem: Date;

  @ApiProperty({ type: 'DATE', example: '2024-08-01T19:54:56.299Z' })
  @IsDateString()
  data_pgto: Date;

  @ApiProperty()
  @ApiProperty({ type: 'DATE', example: '2024-08-01T19:54:56.299Z' })
  @IsDateString()
  data_lancamento: Date;

  @ApiProperty({ example: 10 })
  @IsNumber()
  algoritmo: number;

  @ApiProperty({ type: Number, description: 'Valor de pagamento bloqueado.', example: 10.99 })
  @IsNumber()
  glosa: number;

  @ApiProperty({ type: Number, example: 10.99 })
  @IsNumber()
  recurso: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  anexo: number;

  @ApiProperty({ type: Number, example: 1.99 })
  @IsNumber()
  valor_a_pagar: number;

  @ApiProperty({ description: 'Não sabemos se será número, ser terá zeros a esquerda ou terá letras' })
  @IsNotEmpty()
  @IsString()
  numero_processo: string;

  @ApiProperty({ type: Number, example: 2 })
  @Min(1)
  id_cliente_favorecido: number;

  /** userId - Used internally */
  author: DeepPartial<User>;
}
