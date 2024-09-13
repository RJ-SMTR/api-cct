import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { DetalheAConf } from 'src/cnab/entity/conference/detalhe-a-conf.entity';
import { DetalheBConf } from 'src/cnab/entity/conference/detalhe-b-conf.entity';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { DetalheB } from 'src/cnab/entity/pagamento/detalhe-b.entity';
import { CnabDetalheA_104, CnabDetalheA_104DTO } from './cnab-detalhe-a-104.interface';
import { CnabDetalheB_104, CnabDetalheB_104DTO } from './cnab-detalhe-b-104.interface';

export interface CnabRegistros104Pgto {
  detalheA: CnabDetalheA_104;
  detalheB: CnabDetalheB_104;
}

export class CnabRegistros104PgtoDTO implements CnabRegistros104Pgto {
  constructor(dto: CnabRegistros104Pgto) {
    Object.assign(this, dto);
  }

  static fromEntity(detalheA: DetalheA | DetalheAConf, detalheB: DetalheB | DetalheBConf, favorecido: ClienteFavorecido) {
    return new CnabRegistros104PgtoDTO({
      detalheA: CnabDetalheA_104DTO.fromEntity(detalheA, favorecido),
      detalheB: CnabDetalheB_104DTO.fromEntity(detalheB, favorecido),
    });
  }

  detalheA: CnabDetalheA_104;
  detalheB: CnabDetalheB_104;
}
