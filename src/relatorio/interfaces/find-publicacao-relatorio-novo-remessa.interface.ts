export interface IFindPublicacaoRelatorioNovoRemessa {
  dataInicio: Date;
  dataFim: Date;
  userIds?: number[];
  consorcioNome?: string[];
  valorMin?: number;
  valorMax?: number;
  pago?: boolean;
  aPagar?: boolean;
  emProcessamento?: boolean;
  erro?: boolean;
  todosVanzeiros?: boolean;
  todosConsorcios?: boolean;
  eleicao?: boolean;
  desativados?: boolean;
  pendentes?: boolean;
  pendenciaPaga?: boolean;
}
