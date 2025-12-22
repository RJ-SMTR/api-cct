import { AprovacaoEnum } from 'src/agendamento/enums/aprovacao.enum';
import { DetalheADTO } from 'src/cnab/dto/pagamento/detalhe-a.dto';
import { User } from 'src/users/entities/user.entity';

export class AprovacaoPagamentoDTO  {  
  
  id: number;  

  detalheA: DetalheADTO;

  valorGerado: number;

  valorAprovado: number;

  dataAprovacao: Date;
 
  aprovador: User;

  status: AprovacaoEnum;

}