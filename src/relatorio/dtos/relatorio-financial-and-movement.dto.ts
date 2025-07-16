import { DeepPartial } from 'typeorm';

export class RelatorioFinancialMovementNovoRemessaDto {
  constructor(consolidado?: DeepPartial<RelatorioFinancialMovementNovoRemessaDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  count: number;
  valor: number;
  valorPago: number;
  valorRejeitado: number;
  valorEstornado: number;
  valorAguardandoPagamento: number
  data: RelatorioFinancialMovementNovoRemessaData[];
}

export class RelatorioFinancialMovementNovoRemessaData {
  constructor(consolidado?: DeepPartial<RelatorioFinancialMovementNovoRemessaData>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

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
