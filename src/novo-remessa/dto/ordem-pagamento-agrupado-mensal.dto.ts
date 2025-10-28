export class OrdemPagamentoAgrupadoMensalDto {
  ordemPagamentoAgrupadoId: number | undefined;
  data: Date;
  valorTotal: number | undefined;
  statusRemessa: number | undefined;
  dataPagamento: Date;
  motivoStatusRemessa: string | undefined;
  descricaoStatusRemessa: string | undefined;
  descricaoMotivoStatusRemessa: string | undefined;
}