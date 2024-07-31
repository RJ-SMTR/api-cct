export interface IFindPublicacaoRelatorio {
  /** dataOrdemInicio */
  dataInicio?: Date | undefined;
  /** dataOrdemFim */
  dataFim?: Date | undefined;
  favorecidoNome?: string[];
  favorecidoCpfCnpj?: string[];
  consorcioNome?: string[];
  valorRealEfetivadoMin?: number | undefined;
  valorRealEfetivadoMax?: number | undefined;
  valorMin?: number | undefined;
  valorMax?: number | undefined;
  ocorrenciaCodigo?: string[];
  erro?: boolean;
  pago?: boolean;
  aPagar?: boolean;
  decimais?: number;
}
