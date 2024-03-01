import { IsNotEmpty, ValidateIf } from 'class-validator';

function isCreate(object: SaveTransacaoClienteItemDTO): boolean {
  return object.id === undefined;
}

export class SaveTransacaoClienteItemDTO {
  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  id_item_transacao?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  id_cliente_favorecido?: number;
}
