export interface IFindPublicacaoRelatorio {
  dataInicio?: Date | undefined;
  dataFim?: Date | undefined;
  favorecidoNome?: string[] | undefined ;  
  consorcioNome?: string[] | undefined;
  valorMin?: number | undefined;
  valorMax?: number | undefined;
  pago?: boolean | undefined;
}
