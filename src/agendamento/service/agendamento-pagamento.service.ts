import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Nullable } from "src/utils/types/nullable.type";
import { AgendamentoPagamentoDTO } from "../domain/dto/agendamento-pagamento.dto";
import { AgendamentoPagamento } from "../domain/entity/agendamento-pagamento.entity";
import { AgendamentoPagamentoRepository } from "../repository/agendamento-pagamento.repository";
import { AgendamentoPagamentoConvert } from "../convert/agendamento-pagamento.convert";

@Injectable()
export class AgendamentoPagamentoService {
   
  constructor(
    @InjectRepository(AgendamentoPagamento)
    private agendamentoPagamentoRepository: AgendamentoPagamentoRepository,
    private agendamentoPagamentoConvert: AgendamentoPagamentoConvert
  ) {}

  async findAll(): Promise<AgendamentoPagamentoDTO[]> {      
    const entities = await this.agendamentoPagamentoRepository.findAll();

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
    await this.agendamentoPagamentoRepository.delete(id);
  }

}