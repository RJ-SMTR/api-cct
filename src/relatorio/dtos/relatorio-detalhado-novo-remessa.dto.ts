import { DeepPartial } from 'typeorm';

export class RelatorioDetalhadoNovoRemessaDto {
  constructor(consolidado?: DeepPartial<RelatorioDetalhadoNovoRemessaDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  count: number;
  valor: number;
  data: RelatorioDetalhadoNovoRemessaData[];
}

export class RelatorioDetalhadoNovoRemessaData {
  constructor(consolidado?: DeepPartial<RelatorioDetalhadoNovoRemessaData>) {
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
