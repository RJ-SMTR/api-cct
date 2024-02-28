import { EntityHelper } from 'src/utils/entity-helper';

@Entity()
class DetalheB extends EntityHelper {
  id_detalhe_b: number;
  id_detalhe_a: number;
  nsr: string;
  data_vencimento: Date;
}

function Entity(): (target: typeof DetalheB) => void | typeof DetalheB {
  throw new Error('Function not implemented.');
}
