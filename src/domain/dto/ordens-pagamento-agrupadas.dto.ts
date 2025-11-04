import { OrdemPagamento } from '../entity/ordem-pagamento.entity';

interface OrdensPagamentoAgrupadasDto {
  userId: number;
  idOperadora: string;
  valorTotal: number;
  ordensPagamento: OrdemPagamento[];
}

export { OrdensPagamentoAgrupadasDto };