import { IsNotEmpty, ValidateIf } from "class-validator";

function isCreate(object: ItemTransacaoDTO): boolean {
  return object.id_item_transacao === undefined;
}

export class ItemTransacaoDTO {
  constructor(dto?: ItemTransacaoDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id_item_transacao?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dt_transacao?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dt_processamento?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dt_captura?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  modo?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  id_cliente_favorecido?: number;
}