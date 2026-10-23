import { DeepPartial } from 'typeorm';

export class RelatorioConsolidadoNovoRemessaDto {
  constructor(consolidado?: DeepPartial<RelatorioConsolidadoNovoRemessaDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  count: number;
  valor: number;
  valorAPagar: number;
  data: RelatorioConsolidadoNovoRemessaData[];

}

export class RelatorioConsolidadoNovoRemessaData {
  constructor(consolidado?: DeepPartial<RelatorioConsolidadoNovoRemessaData>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  valor: number;

  nomefavorecido: string;

  cpfCnpj?: string | null;

  // Preenchidos só quando o filtro STUC - Gratuidade está ativo (ADR 0012): um par por dia da
  // janela de pagamento vigente. `valor` acima passa a ser a soma desses dias (deixa de ser o
  // total geral do favorecido no período, que esse filtro não tem mais para uma única linha).
  dataOrdemPagamento1?: string | null;
  valorOrdemPagamento1?: number | null;
  dataOrdemPagamento2?: string | null;
  valorOrdemPagamento2?: number | null;
  dataOrdemPagamento3?: string | null;
  valorOrdemPagamento3?: number | null;
  dataOrdemPagamento4?: string | null;
  valorOrdemPagamento4?: number | null;

}
