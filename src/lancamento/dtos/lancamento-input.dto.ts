import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { User } from 'src/users/entities/user.entity';
import { DeepPartial } from 'typeorm';

export class LancamentoInputDto {
  constructor(dto?: DeepPartial<LancamentoInputDto>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @ApiProperty({ type: Number, example: 1.99 })
  @IsOptional()
  @IsNumber()
  valor: number;

  @ApiProperty({ type: 'DATE', example: '2024-08-01T19:54:56.299Z' })
  @IsDateString()
  data_ordem: Date;

  @ApiProperty()
  @ApiProperty({ type: 'DATE', example: '2024-08-01T19:54:56.299Z' })
  @IsDateString()
  data_lancamento: Date;

  @ApiProperty({ example: 10 })
  @IsNumber()
  algoritmo: number;

  @ApiProperty({ type: Number, required: false, description: 'Valor de pagamento bloqueado.', example: 10.99 })
  @IsOptional()
  @IsNumber()
  glosa?: number;

  @ApiProperty({ type: Number, required: false, example: 10.99 })
  @IsOptional()
  @IsNumber()
  recurso?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  anexo?: number;

  // TODO: Caso não precisemos disso, vamos deletar
  // @ApiProperty({ type: Number, required: false, example: 1.99 })
  // @IsNumber()
  // valor_a_pagar: number;

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
