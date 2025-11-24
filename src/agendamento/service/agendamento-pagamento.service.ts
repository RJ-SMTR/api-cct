import { Injectable } from "@nestjs/common";
import { Nullable } from "src/utils/types/nullable.type";
import { AgendamentoPagamentoDTO } from "../domain/dto/agendamento-pagamento.dto";
import { AgendamentoPagamentoRepository } from "../repository/agendamento-pagamento.repository";
import { AgendamentoPagamentoConvert } from "../convert/agendamento-pagamento.convert";

@Injectable()
export class AgendamentoPagamentoService {
  constructor(
    private readonly agendamentoPagamentoRepository: AgendamentoPagamentoRepository,
    private readonly agendamentoPagamentoConvert: AgendamentoPagamentoConvert,
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
    return this.agendamentoPagamentoConvert.convertEntityToDTO(await this.agendamentoPagamentoRepository.save(agendamentoPagamento));   
  }

  async delete(id:number) {
    return await this.agendamentoPagamentoRepository.delete(id);
  }

}