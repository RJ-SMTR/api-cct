import { Pagador } from "src/cnab/entity/pagamento/pagador.entity";

export interface AllPagadorDict {
  /**
   * Only for items from Lancamento
   * 
   * Conta de Estabilização Tarifária dos Transportes
   */
  cett: Pagador,
  
  /**
   * Jaé. Only for items from OrdemPagamento.
   */
  contaBilhetagem: Pagador,
}