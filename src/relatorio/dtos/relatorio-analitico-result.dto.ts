import { DeepPartial } from 'typeorm';
import { RelatorioAnaliticoDto } from './relatorio-analitico.dto';

export class RelatorioAnaliticoResultDto {
  [x: string]: any;
  constructor(analitico?: DeepPartial<RelatorioAnaliticoResultDto>) {
    if (analitico !== undefined) {
      Object.assign(this, analitico);
    }
  }

  count: number;
  valor: number;
  data: RelatorioAnaliticoDto[];
  status: string;
}
