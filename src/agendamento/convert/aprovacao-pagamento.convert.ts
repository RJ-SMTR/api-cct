import { AprovacaoPagamentoDTO } from "../domain/dto/aprovacao-pagamento.dto";
import { AprovacaoPagamento } from "../domain/entity/aprovacao-pagamento.entity";

export class AprovacaoPagamentoConvert {

  async convertEntityToDTO(
    aprovacaoPagamento: AprovacaoPagamento
  ): Promise<AprovacaoPagamentoDTO> {

    const dto = new AprovacaoPagamentoDTO();
    dto.id = aprovacaoPagamento.id;
    dto.aprovador = aprovacaoPagamento.aprovador;
    dto.dataAprovacao = aprovacaoPagamento.dataAprovacao;
    dto.detalheA.id = aprovacaoPagamento.detalheA.id;
    dto.status = aprovacaoPagamento.status;
    dto.valorAprovado = aprovacaoPagamento.valorAprovado;
    dto.valorGerado = aprovacaoPagamento.valorGerado; 

    return dto;
  }
}