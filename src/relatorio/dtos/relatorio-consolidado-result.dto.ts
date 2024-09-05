import { Exclude } from 'class-transformer';
import { DeepPartial } from 'typeorm';
import { RelatorioConsolidadoDto } from './relatorio-consolidado.dto';

export class RelatorioConsolidadoResultDto {
  [x: string]: any;
  constructor(consolidado?: DeepPartial<RelatorioConsolidadoResultDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }

  count: number;
  valor: number;
  data: RelatorioConsolidadoDto[];
  status: string;
}
