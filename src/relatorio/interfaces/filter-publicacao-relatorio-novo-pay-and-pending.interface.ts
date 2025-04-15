
export interface IFindPublicacaoRelatorioNovoPayAndPending {
  dataInicio: Date;
  dataFim: Date;
  userIds?: number[];
  consorcioNome?: string[];
  valorMin?: number;
  valorMax?: number;
  pago?: boolean;
  erro?: boolean;
  estorno?: boolean;
  rejeitado?: boolean;
}