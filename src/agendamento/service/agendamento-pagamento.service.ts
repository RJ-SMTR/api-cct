import { Injectable } from "@nestjs/common";
import { Nullable } from "src/utils/types/nullable.type";
import { AgendamentoPagamentoDTO } from "../domain/dto/agendamento-pagamento.dto";
import { AgendamentoPagamentoRepository } from "../repository/agendamento-pagamento.repository";
import { AgendamentoPagamentoConvert } from "../convert/agendamento-pagamento.convert";
import { AprovacaoPagamentoRepository } from "../repository/aprovacao-pagamento.repository";
import { UsersService } from 'src/users/users.service';
import { AprovacaoEnum } from "../enums/aprovacao.enum";

@Injectable()
export class AgendamentoPagamentoService {
  constructor(
    private readonly agendamentoPagamentoRepository: AgendamentoPagamentoRepository,
    private readonly agendamentoPagamentoConvert: AgendamentoPagamentoConvert,
    private readonly aprovacaoPagamentoRepository: AprovacaoPagamentoRepository,
    private readonly usersService: UsersService,
  ) { }


  async findAll(): Promise<AgendamentoPagamentoDTO[]> {      
    const entities = await this.agendamentoPagamentoRepository.findAllBooking();

    return Promise.all(
      entities.map(p => this.agendamentoPagamentoConvert.convertEntityToDTO(p))
    );
  }

  async findById(id: number): Promise<Nullable<AgendamentoPagamentoDTO>> { 
    const entity = await this.agendamentoPagamentoRepository.findOne({id: id});
    return entity? this.agendamentoPagamentoConvert.convertEntityToDTO(entity):null;
  }

  async save(agendamentoPagamento: AgendamentoPagamentoDTO):Promise<AgendamentoPagamentoDTO> {    
    
    if (agendamentoPagamento.aprovacao) {
      const novaAprovacao = await this.aprovacaoPagamentoRepository.save({
        valorGerado: 0,
        valorAprovado: 0,
        dataAprovacao: new Date(),
        status: AprovacaoEnum.AguardandoAprovacao,
      } as any);
      
      agendamentoPagamento.aprovacaoPagamentoId = novaAprovacao.id;
    }
    
    return this.agendamentoPagamentoConvert.convertEntityToDTO(await this.agendamentoPagamentoRepository.save(agendamentoPagamento));   
  }

  async delete(id: number, LancamentoAuthorizeDto: string, userId: number): Promise<any> {
    const user = await this.usersService.findOne({ id: userId });
    return await this.agendamentoPagamentoRepository.delete(id, LancamentoAuthorizeDto, user);
  }

}