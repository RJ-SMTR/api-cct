import { ClienteFavorecido } from 'src/domain/entity/cliente-favorecido.entity';
import { DetalheA } from 'src/domain/entity/detalhe-a.entity';
import { DetalheB } from 'src/domain/entity/detalhe-b.entity';
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

  static fromEntity(detalheA: DetalheA , detalheB: DetalheB, favorecido: ClienteFavorecido) {
    return new CnabRegistros104PgtoDTO({
      detalheA: CnabDetalheA_104DTO.fromEntity(detalheA, favorecido),
      detalheB: CnabDetalheB_104DTO.fromEntity(detalheB, favorecido),
    });
  }

  detalheA: CnabDetalheA_104;
  detalheB: CnabDetalheB_104;
}
