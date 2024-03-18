import { IsNotEmpty, ValidateIf } from 'class-validator';
import { Pagador } from '../entity/pagador.entity';

function isCreate(object: TransacaoDTO): boolean {
  return object.id === undefined;
}

export class TransacaoDTO {
  constructor(dto?: TransacaoDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id?: number;
  dataOrdem?: Date | null;
  dataPagamento?: Date | null;
  nomeConsorcio?: string | null;
  nomeOperadora?: string | null;
  servico?: string | null;
  idOrdemPagamento?: string | null;
  idOrdemRessarcimento?: string | null;
  quantidadeTransacaoRateioCredito?: number | null;
  valorRateioCredito?: number | null;
  quantidadeTransacaoRateioDebito?: number | null;
  valorRateioDebito?: number | null;
  quantidadeTotalTransacao?: number | null;
  valorTotalTransacaoBruto?: number | null;
  valorDescontoTaxa?: number | null;
  valorTotalTransacaoLiquido?: number | null;
  quantidadeTotalTransacaoCaptura?: number | null;
  valorTotalTransacaoCaptura?: number | null;
  indicadorOrdemValida?: boolean | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  pagador?: Pagador;
}