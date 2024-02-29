import { IsNotEmpty, ValidateIf } from 'class-validator';

function isCreate(object: SaveTransacaoDTO): boolean {
  return object.id_transacao === undefined;
}

export class SaveTransacaoDTO {
  id_transacao?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dt_ordem?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dt_pagamento?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nome_consorcio?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nome_operadora?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  servico?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  id_ordem_ressarcimento?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  qtde_transacao_rateio_credito?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  vlr_rateio_credito?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  qtde_transacao_rateio_debito?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  vlr_rateio_debito?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  quantidade_total_transacao?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  vlr_total_transacao_bruto?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  vlr_desconto_taxa?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  vlr_total_transacao_liquido?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  qtde_total_transacao_captura?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  vlr_total_transacao_captura?: number;

  @ValidateIf(isCreate)
  indicador_ordem_valida?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  id_pagador?: number;
}
