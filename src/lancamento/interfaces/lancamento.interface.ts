import { ClienteFavorecido } from "src/cnab/entity/cliente-favorecido.entity";
import { DeepPartial } from "typeorm";

export interface ItfLancamento {
  id: number;
  descricao: string;
  valor: string;
  data_ordem: Date;
  data_pgto: Date;
  data_lancamento: Date;
  algoritmo: string,
  glosa: string,
  recurso: string,
  valor_a_pagar: string,
  numero_processo: string,
  id_cliente_favorecido: DeepPartial<ClienteFavorecido>,
}
