import { DeepPartial } from 'typeorm';

export class RelatorioPayAndPendingNovoRemessaDto {
  constructor(consolidado?: DeepPartial<RelatorioPayAndPendingNovoRemessaDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  count: number;
  valor: number;
  data: RelatorioPayAndPendingNovoRemessaData[];
}

export class RelatorioPayAndPendingNovoRemessaData {
  constructor(consolidado?: DeepPartial<RelatorioPayAndPendingNovoRemessaData>) {
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
