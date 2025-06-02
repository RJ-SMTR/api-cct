import { Exclude } from 'class-transformer';
import { DeepPartial } from 'typeorm';

export class RelatorioSinteticoDto {
  constructor(consolidado?: DeepPartial<RelatorioSinteticoDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }  
  valor: number = 0; 
  nome: String;
  @Exclude()
  agrupadoCount: number = 1;
  @Exclude()
  itemCount: number = 1;
}
