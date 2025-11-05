import { Pagador } from "src/domain/entity/pagador.entity";

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