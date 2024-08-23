import { Exclude } from 'class-transformer';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
import { DeepPartial } from 'typeorm';

export class RelatorioSinteticoDto {
  constructor(consolidado?: DeepPartial<RelatorioSinteticoDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }
  @SetValue(val=>+val.toFixed(2))
  valor: number = 0;
  nome: String;
  @Exclude()
  agrupadoCount: number = 1;
  @Exclude()
  itemCount: number = 1;
}
