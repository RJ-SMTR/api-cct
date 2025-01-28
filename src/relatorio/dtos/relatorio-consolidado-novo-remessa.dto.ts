import { DeepPartial } from 'typeorm';

export class RelatorioConsolidadoNovoRemessaDto {
  constructor(consolidado?: DeepPartial<RelatorioConsolidadoNovoRemessaDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  count: number;
  valor: number;
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

}