
export interface IFindPublicacaoRelatorioNovoFinancialMovement {
  dataInicio: Date;
  dataFim: Date;
  userIds?: number[];
  consorcioNome?: string[];
  todosVanzeiros?: boolean;
  valorMin?: number;
  valorMax?: number;
  eleicao?: boolean;
  emProcessamento?: boolean;
  pago?: boolean;
  desativados?: boolean;
  pendentes?: boolean;
  erro?: boolean;
  estorno?: boolean;
  rejeitado?: boolean;
}
