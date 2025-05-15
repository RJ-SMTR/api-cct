import { Exclude } from 'class-transformer';
import { DeepPartial } from 'typeorm';

export class RelatorioExtratoBancarioDto {
  constructor(consolidado?: DeepPartial<RelatorioExtratoBancarioDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }
  
  dataLancamento: Date;
  valorLancamento: number = 0;
  nome: String;
  tipo: String;
  descricao:String;
}
