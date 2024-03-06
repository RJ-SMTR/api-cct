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
}
