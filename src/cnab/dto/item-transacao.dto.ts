import { IsNotEmpty, ValidateIf } from "class-validator";
import { CreateDateColumn, DeepPartial } from "typeorm";
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

  @CreateDateColumn()
  dataProcessamento?: Date;

  @CreateDateColumn()
  dataCaptura?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  clienteFavorecido?: DeepPartial<ClienteFavorecido>;
}