export class OrdemPagamentoPendenteDto {
  id: number;
  valor: number;
  dataPagamento: Date;
  dataReferencia: Date;
  statusRemessa: string;
  motivoStatusRemessa: string;
  ordemPagamentoAgrupadoId: number;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}