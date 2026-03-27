import { DeepPartial } from 'typeorm';

export type RelatorioFinancialMovementNovoRemessaCursor = {
  dataReferencia: string;
  nomes: string;
  status: string;
  cpfCnpj: string;
};

export class RelatorioFinancialMovementNovoRemessaSummaryDto {
  constructor(consolidado?: DeepPartial<RelatorioFinancialMovementNovoRemessaSummaryDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  count: number;
  valorTotal: number;
  valorPago: number;
  valorAPagar: number;
  valorRejeitado: number;
  valorEstornado: number;
  valorAguardandoPagamento: number;
  valorAPagar: number;
  valorPendente: number;
  valorPendenciaPaga: number;
}

export class RelatorioFinancialMovementNovoRemessaPageDto {
  constructor(consolidado?: DeepPartial<RelatorioFinancialMovementNovoRemessaPageDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  currentPage: number;
  pageSize: number;
  data: RelatorioFinancialMovementNovoRemessaData[];
  nextCursor?: RelatorioFinancialMovementNovoRemessaCursor | null;
}

export class RelatorioFinancialMovementNovoRemessaData {
  constructor(consolidado?: DeepPartial<RelatorioFinancialMovementNovoRemessaData>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }


  dataReferencia: string;
  dataPagamento: string;
  nomes: string;
  email: string;
  codBanco: number;
  nomeBanco: string;
  cpfCnpj: string;
  consorcio: string;
  valor: number;
  status: string;
}
