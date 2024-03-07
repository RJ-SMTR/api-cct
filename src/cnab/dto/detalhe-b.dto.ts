import { IsNotEmpty, ValidateIf } from 'class-validator';
import { DeepPartial } from 'typeorm';
import { DetalheA } from '../entity/detalhe-a.entity';

function isCreate(object: DetalheBDTO): boolean {
  return object.id === undefined;
}

export class DetalheBDTO {
  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  detalhe_a?: DeepPartial<DetalheA>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nsr?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataVencimento?: Date;
}

