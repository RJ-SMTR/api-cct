import { Exclude } from 'class-transformer';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
import { DeepPartial } from 'typeorm';

export class RelatorioConsolidadoDto {
  constructor(consolidado?: DeepPartial<RelatorioConsolidadoDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }
  @SetValue(val=>+val.toFixed(2))
  valor = 0;
  nome: string;
  @Exclude()
  agrupadoCount = 1;
  @Exclude()
  itemCount = 1;
}