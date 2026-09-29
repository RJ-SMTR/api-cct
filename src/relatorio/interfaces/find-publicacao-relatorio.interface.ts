export interface IFindPublicacaoRelatorio {
  dataInicio: Date;
  dataFim: Date;
  userIds?: number[];
  favorecidoNome?: string[];  
  consorcioNome?: string[];
  todosConsorcios?: boolean;
  valorMin?: number;
  valorMax?: number;
  pago?: boolean;
  aPagar?: boolean;
  emProcessamento?:boolean;
  rejeitado?: boolean;
  estorno?: boolean;
  pendenciaPaga?: boolean;
  status?: string;
}