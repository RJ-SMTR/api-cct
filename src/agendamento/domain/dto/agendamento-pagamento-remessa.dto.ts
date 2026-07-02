import { IsOptional } from 'class-validator';
import { AprovacaoPagamentoDTO } from './aprovacao-pagamento.dto';
import { PagadorDTO } from 'src/cnab/dto/pagamento/pagador.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

export class AgendamentoPagamentoRemessaDTO {

  agendamentoIds: number[] = [];

  aprovacaoPagamentoIds: number[] = [];

  tipoBeneficiario?: string | null;

  modoAgrupamento?: 'nomeConsorcio' | 'userId' | null;

  nomeConsorcios: string[] = [];
  
  beneficiarios: CreateUserDto[]=[];

  tipoPagamento?: string | null; // Unico / Recorrente

  dataPagamentoUnico?: Date;

  valorPagamentoUnico?: number;

  motivoPagamentoUnico?: string;

  horario: string = '';

  pagador: PagadorDTO = {} as PagadorDTO;

  aprovacao?: boolean;

  diaInicioPagar: number = 0;

  diaFinalPagar: number = 0;

  diaIntervalo: number = 0;

  @IsOptional()
  aprovacaoPagamento?: AprovacaoPagamentoDTO;
  
}
