export interface ItfLancamento {
  id: number;
  descricao: string;
  valor: number;
  data_ordem: Date;
  data_pgto: Date;
  autorizacoes?: string;
  userId?: number;
}
