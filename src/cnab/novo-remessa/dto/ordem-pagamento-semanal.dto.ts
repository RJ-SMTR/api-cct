import { DeepPartial } from 'typeorm';

export class OrdemPagamentoSemanalDto {
  ordemId: number
  valor: number;
  dataOrdem: Date;
  dataReferencia: Date;
  statusRemessa: number | undefined;
  motivoStatusRemessa: string | undefined;
  dataCaptura: Date | undefined;

  constructor(dto?: DeepPartial<OrdemPagamentoSemanalDto>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }
}