import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsString,
  isNumber
} from 'class-validator';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { stringToNumberTransformer } from 'src/utils/transformers/string-to-number.transformer';
import { ValidateValue } from 'src/utils/validators/validate-value.validator';
import { DeepPartial } from 'typeorm';

export class LancamentoDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  descricao: string;

  @ApiProperty({ type: String, example: '1.99' })
  @Transform(stringToNumberTransformer)
  @IsNumber()
  valor: number;

  @ApiProperty()
  @Transform((p) => new Date(p.value))
  @IsDate()
  data_ordem: Date;

  @ApiProperty()
  @Transform((p) => new Date(p.value))
  @IsDate()
  data_pgto: Date;

  @ApiProperty()
  @Transform((p) => new Date(p.value))
  @IsDate()
  data_lancamento: Date;

  @ApiProperty({ example: '1' })
  @IsNumberString()
  algoritmo: string;

  @ApiProperty({ example: '1' })
  @IsNumberString()
  glosa: string;

  @ApiProperty({ example: '1' })
  @IsNumberString()
  recurso: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  anexo: string;

  @ApiProperty({ type: String, example: '1.99' })
  @Transform(stringToNumberTransformer)
  @IsNumber()
  valor_a_pagar: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  numero_processo: string;

  @ApiProperty({ type: Number, example: 2 })
  @Transform((params) => ({
    id: params.value,
  }))
  @ValidateValue((v) => isNumber(v.id) && v.id > 0, {
    message: (v) =>
      `Is not a number > 0 but ${v.value?.id} (type ${typeof v.value?.id})`,
  })
  id_cliente_favorecido: DeepPartial<ClienteFavorecido>;
}
