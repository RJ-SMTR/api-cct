import { DeepPartial } from 'typeorm';

export type RelatorioFinancialMovementNovoRemessaCursor = {
  dataReferencia: string;
  nomes: string;
  status: string;
  cpfCnpj: string;
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
  count?: Number;
  valorTotal?: Number;
  valorPago?: Number;
  valorRejeitado?: Number;
  valorEstornado?: Number;
  valorAguardandoPagamento?: Number;
  valorAPagar?: Number;
  valorPendente?: Number;
  valorPendenciaPaga?: Number;
}

export class RelatorioFinancialMovementNovoRemessaData {
  constructor(consolidado?: DeepPartial<RelatorioFinancialMovementNovoRemessaData>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
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
}
