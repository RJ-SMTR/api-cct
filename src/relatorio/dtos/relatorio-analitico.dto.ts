import { DeepPartial } from 'typeorm';

export class RelatorioAnaliticoDto {
  constructor(analitico?: DeepPartial<RelatorioAnaliticoDto>) {
    if (analitico !== undefined) {
      Object.assign(this, analitico);
    }
  }
  
  dataEfetivacao: Date;
  dataVencimento: Date;
  favorecido: string;
  consorcio: string;
  valorTransacao: number = 0;
  status: string;
  ocorrencia: string;  
}