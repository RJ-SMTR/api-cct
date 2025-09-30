import { DeepPartial } from 'typeorm';

export class OrdemPagamentoSemanalDto {
  ordemId: number | undefined;
  valor: number;
  dataOrdem: Date;
  dataReferencia: Date;
  dataPagamento: Date;
  statusRemessa: number | undefined;
  motivoStatusRemessa: string | undefined;
  dataCaptura: Date | undefined;
  ids: any[];

  constructor(dto?: DeepPartial<OrdemPagamentoSemanalDto>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }
}