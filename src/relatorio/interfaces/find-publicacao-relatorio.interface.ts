export interface IFindPublicacaoRelatorio {
  dataInicio: Date;
  dataFim: Date;
  favorecidoNome?: string[];
  consorcioNome?: string[];
  valorMin?: number;
  valorMax?: number;
  pago?: boolean;
  aPagar?: boolean;
  emProcessamento?: boolean;
  eleicao?: boolean;
}