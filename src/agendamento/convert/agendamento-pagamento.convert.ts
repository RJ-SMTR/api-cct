import { AgendamentoPagamentoDTO } from "../domain/dto/agendamento-pagamento.dto";
import { AgendamentoPagamento } from "../domain/entity/agendamento-pagamento.entity";
import { AprovacaoPagamentoDTO } from "../domain/dto/aprovacao-pagamento.dto";
import { PagadorDTO } from "src/cnab/dto/pagamento/pagador.dto";
import { CreateUserDto } from "src/users/dto/create-user.dto";


export class AgendamentoPagamentoConvert {

  async convertEntityToDTO(
    agendamentoPagamento: AgendamentoPagamento
  ): Promise<AgendamentoPagamentoDTO> {

    const dto = new AgendamentoPagamentoDTO();
    dto.id = agendamentoPagamento.id;
    dto.tipoBeneficiario = agendamentoPagamento.tipoBeneficiario;
    dto.beneficiarioUsuario = agendamentoPagamento.beneficiarioUsuario as CreateUserDto;
    dto.tipoPagamento = agendamentoPagamento.tipoPagamento;
    dto.dataPagamentoUnico = agendamentoPagamento.dataPagamentoUnico;
    dto.valorPagamentoUnico = agendamentoPagamento.valorPagamentoUnico;
    dto.motivoPagamentoUnico = agendamentoPagamento.motivoPagamentoUnico;
    dto.pagador = agendamentoPagamento.pagador as PagadorDTO;
    dto.diaSemana = agendamentoPagamento.diaSemana;
    dto.horario = agendamentoPagamento.horario;
    dto.responsavel = agendamentoPagamento.responsavel as CreateUserDto;
    dto.aprovacao = agendamentoPagamento.aprovacao;
    dto.aprovacaoPagamento = agendamentoPagamento.aprovacaoPagamento as AprovacaoPagamentoDTO;
    dto.cadastrador = agendamentoPagamento.cadastrador as CreateUserDto;
    dto.modificador = agendamentoPagamento.modificador as CreateUserDto;
    dto.status = agendamentoPagamento.status;

    return dto;
  }
}