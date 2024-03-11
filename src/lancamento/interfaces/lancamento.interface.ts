import { ClienteFavorecido } from "src/cnab/entity/cliente-favorecido.entity";
import { DeepPartial } from "typeorm";

export interface ItfLancamento {
  id: number;
  descricao: string;
  valor: number;
  data_ordem: Date;
  data_pgto: Date;
  algoritmo: number,
  glosa: number,
  recurso: number,
  valor_a_pagar: number,
  numero_processo: number,
  id_cliente_favorecido: DeepPartial<ClienteFavorecido>,
}
