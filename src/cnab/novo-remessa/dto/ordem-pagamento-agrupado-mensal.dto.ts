export class OrdemPagamentoAgrupadoMensalDto {
  ordemPagamentoAgrupadoId: number | undefined;
  ordemPagamentoAgrupadoIds: string[];
  data: Date;
  valorTotal: number | undefined;
  statusRemessa: number | undefined;
  dataPagamento: Date;
  motivoStatusRemessa: string | undefined;
  descricaoStatusRemessa: string | undefined;
  descricaoMotivoStatusRemessa: string | undefined;

  /** Agrupamento paralelo de Gratuidade (pagador CETT) — independente do agrupamento acima. */
  valorGratuidade: number | undefined;
  statusRemessaGratuidade: number | undefined;
  motivoStatusRemessaGratuidade: string | undefined;
  descricaoStatusRemessaGratuidade: string | undefined;
  descricaoMotivoStatusRemessaGratuidade: string | undefined;
}