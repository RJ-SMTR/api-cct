import { DeepPartial } from 'typeorm';

export class RelatorioFinancialMovementNovoRemessaDto {
  constructor(consolidado?: DeepPartial<RelatorioFinancialMovementNovoRemessaDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  count: number;
  valor: number;
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
  cpfCnpj: string;
  consorcio: string;
  valor: number;
  status: string;
}
