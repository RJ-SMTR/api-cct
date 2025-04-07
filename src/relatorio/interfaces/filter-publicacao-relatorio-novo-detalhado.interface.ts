
export interface IFindPublicacaoRelatorioNovoDetalhado {
  dataInicio: Date;
  dataFim: Date;
  userIds?: number[];
  consorcioNome?: string[];
  valorMin?: number;
  valorMax?: number;
  todosVanzeiros?: boolean;
  todosConsorcios?: boolean;
  pago?: boolean;
  erroPago?: boolean;
  estorno?: boolean;
  rejeitado?: boolean;
}