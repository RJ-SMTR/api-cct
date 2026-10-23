import { DeepPartial } from 'typeorm';
import { getDescricaoErro } from '../novo-remessa/queries/descricao-erro';

export type RelatorioFinancialMovementNovoRemessaCursor = {
  dataReferencia: string;
  nomes: string;
  status: string;
  cpfCnpj: string;
  // Extra tie-breakers so the cursor uniquely identifies a grouped row even when two rows
  // share dataReferencia/nomes/status/cpfCnpj (e.g. same favorecido paid under two
  // different consórcios on the same date). Populated by both the Guardador and the
  // Permissionário report; codigoErro is Guardador-only (no such column there).
  nomeConsorcio?: string;
  codBanco?: string;
  dataPagamento?: string;
  codigoErro?: string;
  email?: string;
};

export class RelatorioFinancialMovementNovoRemessaSummaryDto {
  constructor(movimentacao?: DeepPartial<RelatorioFinancialMovementNovoRemessaSummaryDto>) {
    if (movimentacao !== undefined) {
      Object.assign(this, movimentacao);
    }
  }

  count?: number;
  valorTotal?: number;
  valorPago?: number;
  valorRejeitado?: number;
  valorEstornado?: number;
  valorAguardandoPagamento?: number;
  valorAPagar?: number;
  valorPendente?: number;
  valorPendenciaPaga?: number;
}

export class RelatorioFinancialMovementNovoRemessaPageDto {
  constructor(movimentacao?: DeepPartial<RelatorioFinancialMovementNovoRemessaPageDto>) {
    if (movimentacao !== undefined) {
      Object.assign(this, movimentacao);
    }
  }

  currentPage?: number;
  pageSize?: number;
  data?: RelatorioFinancialMovementNovoRemessaData[];
  nextCursor?: RelatorioFinancialMovementNovoRemessaCursor | string | null ;
  count?: number;
  valorTotal?: number;
  valorPago?: number;
  valorRejeitado?: number;
  valorEstornado?: number;
  valorAguardandoPagamento?: number;
  valorAPagar?: number;
  valorPendente?: number;
  valorPendenciaPaga?: number;
}

export class RelatorioFinancialMovementNovoRemessaData {
  // "codigoErro" is the raw occurrence code of the row (or an aggregated list of them). It is
  // only an input: the response exposes the human readable descricaoErro instead.
  constructor(consolidado?: DeepPartial<RelatorioFinancialMovementNovoRemessaData> & { codigoErro?: string | null }) {
    if (consolidado !== undefined) {
      const { codigoErro, ...rest } = consolidado;
      Object.assign(this, rest);

      const descricaoErro = getDescricaoErro(this.status, codigoErro);
      if (descricaoErro !== undefined) {
        this.descricaoErro = descricaoErro;
      }
    }
  }

  dataReferencia?: string;
  dataPagamento?: string;
  nomes?: string;
  email?: string;
  codBanco?: number;
  nomeBanco?: string;
  cpfCnpj?: string;
  consorcio?: string;
  valor?: number;
  status?: string;
  descricaoErro?: string;

  // Preenchidos só quando o filtro STUC - Gratuidade está ativo (ADR 0012): um par por dia da
  // janela de pagamento vigente (sexta-segunda, 4 dias; terça-quinta, 3 dias). `valor` acima
  // passa a ser a soma desses dias, não um pagamento isolado.
  dataOrdemPagamento1?: string | null;
  valorOrdemPagamento1?: number | null;
  dataOrdemPagamento2?: string | null;
  valorOrdemPagamento2?: number | null;
  dataOrdemPagamento3?: string | null;
  valorOrdemPagamento3?: number | null;
  dataOrdemPagamento4?: string | null;
  valorOrdemPagamento4?: number | null;
}
