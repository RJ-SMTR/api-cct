import { DeepPartial } from 'typeorm';

export class RelatorioDetalhadoVanzeiroDto {
  constructor(detalhado?: DeepPartial<RelatorioDetalhadoVanzeiroDto>) {
    if (detalhado !== undefined) {
      Object.assign(this, detalhado);
    }
  }
  dataVencimento: Date;
  valor: number;  
  nome: String;
  motivo: String;
  status: String;
}