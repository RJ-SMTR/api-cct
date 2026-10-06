import { DeepPartial } from 'typeorm';

export class OrdemPagamentoUnicoDto {
  id: number | undefined;
  idOrdemPagamento: number;
  opradoraCpfCnpj: string;
  dataOrdem: string;
  consorcio: string;
  idOperadora: string;
  operadora: string;
  quantidadeTransacaoGratuidade: number;
  valorTotalTransacaoLiquido: number;

  constructor(dto?: DeepPartial<OrdemPagamentoUnicoDto>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }
}