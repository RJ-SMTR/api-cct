import { IsNotEmpty, ValidateIf } from 'class-validator';

function isCreate(object: PagadorDTO): boolean {
  return object.id === undefined;
}

export class PagadorDTO {
  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nomeEmpresa?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  agencia?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvAgencia?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  conta?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvConta?: string;

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
  complementoCep?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  uf?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cpfCnpj?: string;
}
