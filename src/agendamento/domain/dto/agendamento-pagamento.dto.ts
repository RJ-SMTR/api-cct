import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { User } from 'src/users/entities/user.entity';
import { AprovacaoPagamentoDTO } from './aprovacao-pagamento.dto';

export class AgendamentoPagamentoDTO { 

  id: number;  

  tipoBeneficiario: string | null;//Consorcio /Individual

  beneficiarioUsuario: User;

  tipoPagamento: string | null; //Unico/Recorrente

  dataPagamentoUnico: Date;
  
  valorPagamentoUnico: number;

  motivoPagamentoUnico: string;

  pagador: Pagador;

  diaSemana: string;

  horario: Date;

  responsavel: User;

  aprovacao: Boolean;

  aprovacaoPagamento: AprovacaoPagamentoDTO;

  cadastrador: User;

  modificador: User;

  status: Boolean;
}