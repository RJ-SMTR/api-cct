import { DeepPartial } from 'typeorm';

export class RelatorioExtratoBancarioDto {
  constructor(consolidado?: DeepPartial<RelatorioExtratoBancarioDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }
  
  dataLancamento: Date;
  valorLancamento: number = 0;  
  tipo: String;
  operacao:String;
  valorSaldoInicial: number;
}
