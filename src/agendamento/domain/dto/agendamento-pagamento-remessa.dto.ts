import { IsOptional } from 'class-validator';
import { AprovacaoPagamentoDTO } from './aprovacao-pagamento.dto';
import { PagadorDTO } from 'src/cnab/dto/pagamento/pagador.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

export class AgendamentoPagamentoRemessaDTO {

  tipoBeneficiario?: string | null;
  
  beneficiarios: CreateUserDto[];

  tipoPagamento?: string | null; // Unico / Recorrente

  dataPagamentoUnico?: Date;

  valorPagamentoUnico?: number;

  motivoPagamentoUnico?: string;

  horario: string;

  pagador?: PagadorDTO;

  aprovacao?: boolean;

  diaInicioPagar:number;

  diaFinalPagar:number;

  @IsOptional()
  aprovacaoPagamento?: AprovacaoPagamentoDTO;
  
}
