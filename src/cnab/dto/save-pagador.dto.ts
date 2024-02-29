import { IsNotEmpty, ValidateIf } from 'class-validator';

function isCreate(object: SavePagadorDTO): boolean {
  return object.id_pagador === undefined;
}

export class SavePagadorDTO {
  id_pagador?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nome_empresa: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  agencia: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dv_agencia: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  conta: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dv_conta: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  logradouro: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numero: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  complemento: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  bairro: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cidade: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cep: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  complemento_cep: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  uf: string;
}
