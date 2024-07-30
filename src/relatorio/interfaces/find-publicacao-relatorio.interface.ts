export interface IFindPublicacaoRelatorio {
  /** dataOrdemInicio */
  dataInicio?: Date | undefined;
  /** dataOrdemFim */
  dataFim?: Date | undefined;
  favorecidoNome?: string[];
  favorecidoCpfCnpj?: string[];
  valorRealEfetivadoInicio?: number | undefined;
  valorRealEfetivadoFim?: number | undefined;
  ocorrenciaCodigo?: string[];
  erro?: boolean;
  pago?: boolean;
}
