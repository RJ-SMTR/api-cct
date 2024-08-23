import { DeepPartial } from 'typeorm';
import { RelatorioSinteticoDto } from './relatorio-sintetico.dto';

export class RelatorioSinteticoResultDto {
  [x: string]: any;
  constructor(sintetico?: DeepPartial<RelatorioSinteticoResultDto>) {
    if (sintetico !== undefined) {
      Object.assign(this, sintetico);
    }
  }

  count: number;
  valor: number;
  data: RelatorioSinteticoDto[];
  status: string;
}
