import { IsNotEmpty, ValidateIf } from 'class-validator';
import { DeepPartial } from 'typeorm';
import { DetalheA } from '../../entity/pagamento/detalhe-a.entity';

function isCreate(object: DetalheBDTO): boolean {
  return object.id === undefined;
}

export class DetalheBDTO {
  constructor(dto?: DetalheBDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  detalheA?: DeepPartial<DetalheA>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nsr?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataVencimento?: Date;
}

