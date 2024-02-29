import { EntityHelper } from 'src/utils/entity-helper';
import { DeepPartial, Entity } from 'typeorm';

@Entity()
export class DetalheB extends EntityHelper {
  constructor(detalheB?: DetalheB | DeepPartial<DetalheB>) {
    super();
    if (detalheB !== undefined) {
      Object.assign(this, detalheB);
    }
  }

  id_detalhe_b: number;
  id_detalhe_a: number;
  nsr: string;
  data_vencimento: Date;

  public getLogInfo(): string {
    const response = `#${this.id_detalhe_b}`;
    return response;
  }
}
