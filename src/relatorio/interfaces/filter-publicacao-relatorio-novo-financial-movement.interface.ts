export interface IFindPublicacaoRelatorioNovoFinancialMovement {
  dataInicio: Date;
  dataFim: Date;
  page?: number;
  pageSize?: number;
  cursorDataReferencia?: string;
  cursorNome?: string;
  cursorStatus?: string;
  cursorCpfCnpj?: string;
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
