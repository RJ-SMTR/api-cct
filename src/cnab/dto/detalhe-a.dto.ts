import { IsNotEmpty, ValidateIf } from 'class-validator';

function isCreate(object: DetalheADTO): boolean {
  return object.id_detalhe_a === undefined;
}

export class DetalheADTO {
  id_detalhe_a?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  id_header_lote?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  lote_servico?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  id_cliente_favorecido?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipo_finalidade_conta?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dt_vencimento?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipo_moeda?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  qtde_moeda?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valor_lancamento?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  num_doc_lancamento?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  qtde_parcelas?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  indicador_bloqueio?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  indicador_forma_parcelamento?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  periodo_vencimento?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  num_parcela?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  data_efetivacao?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valor_real_efetivado?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nsr: number;

  ocorrencias?: string;

}
