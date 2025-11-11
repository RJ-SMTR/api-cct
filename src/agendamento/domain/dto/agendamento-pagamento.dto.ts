import { AprovacaoPagamentoDTO } from './aprovacao-pagamento.dto';
import { PagadorDTO } from 'src/cnab/dto/pagamento/pagador.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

export class AgendamentoPagamentoDTO { 

  id: number;  

  tipoBeneficiario: string | null;//Consorcio /Individual

  beneficiarioUsuario: CreateUserDto;

  tipoPagamento: string | null; //Unico/Recorrente

  dataPagamentoUnico: Date;
  
  valorPagamentoUnico: number;

  motivoPagamentoUnico: string;

  pagador: PagadorDTO;

  diaSemana: string;

  horario: Date;

  responsavel: CreateUserDto;

  aprovacao: Boolean;

  aprovacaoPagamento: AprovacaoPagamentoDTO;

  cadastrador: CreateUserDto;

  modificador: CreateUserDto;

  status: Boolean;
}