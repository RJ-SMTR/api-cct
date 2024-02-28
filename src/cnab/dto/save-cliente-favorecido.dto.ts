import { IsNotEmpty, ValidateIf } from 'class-validator';

function isCreate(object: SaveClienteFavorecidoDto): boolean {
  return object.id_cliente_favorecido === undefined;
}

export class SaveClienteFavorecidoDto {
  id_cliente_favorecido?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nome?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cpf_cnpj?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cod_banco?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  agencia?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dv_agencia?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  conta_corrente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dv_conta_corrente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  logradouro?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numero?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  complemento?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  bairro?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cidade?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cep?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  complemento_cep?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  uf?: string;
}
