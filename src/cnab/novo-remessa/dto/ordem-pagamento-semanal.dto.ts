import { DeepPartial } from 'typeorm';

export class OrdemPagamentoSemanalDto {
  valor: number;
  dataOrdem: Date;
  dataReferencia: Date;
  statusRemessa: string;
  motivoStatusRemessa: string;

  constructor(dto?: DeepPartial<OrdemPagamentoSemanalDto>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }
}