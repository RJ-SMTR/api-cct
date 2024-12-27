import { DeepPartial } from 'typeorm';

export class OrdemPagamentoDiarioDto {
  valor: number;
  dataOrdem: Date;
  dataReferencia: Date;
  statusRemessa: string;
  motivoStatusRemessa: string;

  constructor(dto?: DeepPartial<OrdemPagamentoDiarioDto>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }
}