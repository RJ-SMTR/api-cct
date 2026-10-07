import { DeepPartial } from 'typeorm';

export class RelatorioExtratoBancarioDto {
  constructor(consolidado?: DeepPartial<RelatorioExtratoBancarioDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }
  
  dataLancamento: Date;
  valorLancamento = 0;  
  tipo: string;
  operacao:string;
  valorSaldoInicial: number;
}
