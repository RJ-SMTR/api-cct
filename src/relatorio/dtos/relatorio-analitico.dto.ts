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
  valor: number = 0;
  status: string;
  ocorrencia: string;
  subtotal: number = 0;
  total: number = 0;

  setSubtotal(subtotais: Record<string, number>) {
    if (!this.consorcio) {
      return;
    }
    const subtotal = subtotais?.[this.consorcio];
    if (!subtotal) {
      return;
    }
    this.subtotal = +subtotal.toFixed(2);
  }

  setTotal(total: number) {
    this.total = +total.toFixed(2);
  }
}
