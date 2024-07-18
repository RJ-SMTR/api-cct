import { IsNotEmpty, ValidateIf } from 'class-validator';
import { AgendamentoPagamento } from 'src/agendamento-pagamento/agendamento-pagamento.entity';
import { TipoFavorecidoEnum } from 'src/tipo-favorecido/tipo-favorecido.enum';
import { SetValueIf } from 'src/utils/decorators/set-value-if.decorator';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
import { DeepPartial, JoinColumn, ManyToOne } from 'typeorm';

function isCreate(object: SaveClienteFavorecidoDTO): boolean {
  return object.id === undefined;
}

export class SaveClienteFavorecidoDTO {
  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nome?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cpfCnpj?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoBanco?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  agencia?: string;

  dvAgencia?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  contaCorrente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvContaCorrente?: string;

  tipo?: TipoFavorecidoEnum | null;

  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  cep?: string | null;
  complementoCep?: string | null;
  uf?: string | null;

  @SetValueIf((v) => !v, null)
  agendamentoPagamento?: DeepPartial<AgendamentoPagamento> | null;
}
