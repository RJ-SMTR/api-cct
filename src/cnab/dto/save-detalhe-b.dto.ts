import { IsNotEmpty, ValidateIf } from 'class-validator';

function isCreate(object: SaveDetalheBDTO): boolean {
  return object.id_detalhe_a === undefined;
}

export class SaveDetalheBDTO {
  id_detalhe_b?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  id_detalhe_a?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nsr?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  data_vencimento?: Date;
}
