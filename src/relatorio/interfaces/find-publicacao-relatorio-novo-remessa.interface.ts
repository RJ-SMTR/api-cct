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
  stucGratuidade?: boolean;
  pendenciaPaga?: boolean;
  rejeitado?: boolean;
  estorno?: boolean;
  // Favorecido escolhido + consorcio: so o favorecido, dentro do consorcio (como a Movimentacao
  // Financeira), em vez de unir as visoes de favorecido e de consorcio.
  favorecidoNoConsorcio?: boolean;
  page?: number;
  pageSize?: number;
}

