import { IsNotEmpty, ValidateIf } from "class-validator";
import { DeepPartial } from "typeorm";
import { ClienteFavorecido } from "../entity/cliente-favorecido.entity";

function isCreate(object: ItemTransacaoDTO): boolean {
  return object.id === undefined;
}

export class ItemTransacaoDTO {
  constructor(dto?: ItemTransacaoDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataTransacao?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataProcessamento?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataCaptura?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  modo?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  clienteFavorecido?: DeepPartial<ClienteFavorecido>;
}