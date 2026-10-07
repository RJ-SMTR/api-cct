import { Exclude } from 'class-transformer';
import { DeepPartial } from 'typeorm';

export class RelatorioSinteticoDto {
  constructor(consolidado?: DeepPartial<RelatorioSinteticoDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }
  
  valor = 0;
  total = 0;
  nome: string;
  @Exclude()
  agrupadoCount = 1;
  @Exclude()
  itemCount = 1;
}
