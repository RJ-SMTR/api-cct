import { Exclude } from 'class-transformer';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
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
  constructor(consolidado?: DeepPartial<RelatorioConsolidadoNovoRemessaDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  valor: number;

  nomefavorecido: string;

}