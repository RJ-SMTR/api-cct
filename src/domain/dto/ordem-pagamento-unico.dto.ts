import { DeepPartial } from 'typeorm';

export class OrdemPagamentoUnicoDto {
  id: number | undefined;
  idOrdemPagamento: number;
  opradoraCpfCnpj: String;
  dataOrdem: String;
  consorcio: String;
  idOperadora: String;
  operadora: String;
  quantidadeTransacaoGratuidade: number;
  valorTotalTransacaoLiquido: number;

  constructor(dto?: DeepPartial<OrdemPagamentoUnicoDto>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }
}