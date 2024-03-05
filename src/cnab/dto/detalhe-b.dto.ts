import { IsNotEmpty, ValidateIf } from 'class-validator';

function isCreate(object: DetalheBDTO): boolean {
  return object.id_detalhe_a === undefined;
}

export class DetalheBDTO {
  id_detalhe_b?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  id_detalhe_a?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nsr?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  data_vencimento?: Date;
}

