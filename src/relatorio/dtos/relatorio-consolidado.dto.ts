import { DeepPartial } from 'typeorm';

export class RelatorioConsolidadoDto {
  constructor(consolidado?: DeepPartial<RelatorioConsolidadoDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  valor: number = 0;
  nome: String;
  count: number = 1;
}
