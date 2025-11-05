import { ClienteFavorecido } from 'src/domain/entity/cliente-favorecido.entity';
import { DeepPartial } from 'typeorm';
import { User } from '../entity/user.entity';

export interface LancamentoSeedData {
  id?: number;
  valor: number;
  data_lancamento: Date;
  data_ordem: Date;
  data_pgto: Date;
  algoritmo: number;
  glosa: number;
  recurso: number;
  valor_a_pagar: number;
  numero_processo: string;
  clienteFavorecido: DeepPartial<ClienteFavorecido>;
  autor: DeepPartial<User>;
  /** @example `1,2,3` */
  autorizado_por?: string;
  anexo: number;
}
