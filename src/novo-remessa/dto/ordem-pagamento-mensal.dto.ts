import { OrdemPagamentoAgrupadoMensalDto } from './ordem-pagamento-agrupado-mensal.dto';

export class OrdemPagamentoMensalDto {
  ordens: OrdemPagamentoAgrupadoMensalDto[];
  valorTotal: number;
  valorTotalPago: number;
}