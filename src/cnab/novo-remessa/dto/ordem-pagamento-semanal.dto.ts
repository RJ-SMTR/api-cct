import { DeepPartial } from 'typeorm';

export class OrdemPagamentoSemanalDto {
  ordemId: number | undefined;
  valor: number;
  dataOrdem: Date;
  dataReferencia: Date;
  statusRemessa: number | undefined;
  motivoStatusRemessa: string | undefined;
  dataCaptura: Date | undefined;
  ids: any[];
  /** Total de Gratuidade do dia (agrupamento paralelo, independente do valor normal). */
  valorGratuidade: number | undefined;
  /** Data efetiva do pagamento (Detalhe A), só para ordens pagas. */
  dataEfetivaPagamento: Date | undefined;

  constructor(dto?: DeepPartial<OrdemPagamentoSemanalDto>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }
}