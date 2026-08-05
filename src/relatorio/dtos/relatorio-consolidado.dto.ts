import { Exclude } from 'class-transformer';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
import { DeepPartial } from 'typeorm';

export class RelatorioConsolidadoDto {
  constructor(consolidado?: DeepPartial<RelatorioConsolidadoDto>) {
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