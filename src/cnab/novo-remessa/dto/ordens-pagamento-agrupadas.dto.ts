import { OrdemPagamento } from '../entity/ordem-pagamento.entity';

interface OrdensPagamentoAgrupadasDto {
  userId: number;
  dataOrdem: Date;
  idOperadora: string;
  valorTotal: number;
  ordensPagamento: OrdemPagamento[];
}

export { OrdensPagamentoAgrupadasDto };