import { Pagador } from '../entity/pagador.entity';

export class TransacaoDTO {
  id: number;
  dataOrdem?: Date | null;
  dataPagamento?: Date | null;
  nomeConsorcio?: string | null;
  nomeOperadora?: string | null;
  servico?: string | null;
  idOrdemPagamento?: number | null;
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
  pagador?: Pagador;
}