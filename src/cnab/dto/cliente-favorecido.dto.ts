import { IsNotEmpty, ValidateIf } from 'class-validator';

function isCreate(object: SaveClienteFavorecidoDTO): boolean {
  return object.id_cliente_favorecido === undefined;
}

export class SaveClienteFavorecidoDTO {
  id_cliente_favorecido?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nome?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cpf_cnpj?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cod_banco?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  agencia?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dv_agencia?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  conta_corrente?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dv_conta_corrente?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  logradouro?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numero?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  complemento?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  bairro?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cidade?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cep?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  complemento_cep?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  uf?: string | null;
}
