import { ClienteFavorecido } from "src/cnab/entity/cliente-favorecido.entity";
import { DeepPartial } from "typeorm";

/**
 * Used as output data to frontend
 */
export interface ItfLancamento {
  id: number;
  descricao: string;
  valor: number;
  data_ordem: Date;
  data_pgto: Date;
  data_lancamento: Date;
  algoritmo: string;
  glosa: string;
  recurso: string;
  anexo: string;
  valor_a_pagar: number;
  numero_processo: string;
  id_cliente_favorecido: DeepPartial<ClienteFavorecido>;
  // Added fields
  auth_usersIds: number[];
  autorizadopor: number[];
}
