import { DeepPartial } from "typeorm/common/DeepPartial";

export class OrdemPagamentoPendenteDto {
  constructor(dto?: DeepPartial<OrdemPagamentoPendenteDto>) {
      if (dto) {
      Object.assign(this, dto);
    }
  }
  idOrdemPagamento: number;
  nome: string; 
  dataOrdem: Date;
  consorcio: string;
  valor: number;
}