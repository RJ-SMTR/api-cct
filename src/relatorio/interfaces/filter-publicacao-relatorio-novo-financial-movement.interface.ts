export interface IFindPublicacaoRelatorioNovoFinancialMovement {
  dataInicio: Date;
  dataFim: Date;
  page?: number;
  pageSize?: number;
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
  pendenciaPaga?: boolean;
  aPagar?: boolean;
}
