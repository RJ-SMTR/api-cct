import { IsNotEmpty, ValidateIf } from 'class-validator';

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
  cpfCnpj?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoBanco?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  agencia?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvAgencia?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  contaCorrente?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvContaCorrente?: string | null;

  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  cep?: string | null;
  complementoCep?: string | null;
  uf?: string | null;
}
