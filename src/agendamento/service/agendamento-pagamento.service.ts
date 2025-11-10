import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityCondition } from "src/utils/types/entity-condition.type";
import { Nullable } from "src/utils/types/nullable.type";
import { DataSource, Repository } from "typeorm";
import { AgendamentoPagamentoDTO } from "../domain/dto/agendamento-pagamento.dto";
import { AgendamentoPagamento } from "../domain/entity/agendamento-pagamento.entity";
import { AgendamentoPagamentoRepository } from "../repository/agendamento-pagamento.repository";


@Injectable()
export class AgendamentoPagamentoService {
  
  constructor(
    @InjectRepository(AgendamentoPagamento)
    private readonly infoRepository: Repository<AgendamentoPagamento>,
    private dataSource: DataSource,
    private agendamentoPagamentoRepository: AgendamentoPagamentoRepository
  ) {}

  async find(fields?: EntityCondition<AgendamentoPagamento>): Promise<Nullable<AgendamentoPagamento[]>> {
    return this.infoRepository.find({
      where: fields,
    });
  }

  async findAll(){      
    return this.agendamentoPagamentoRepository.findAll(); 
  } 

  async save(agendamentoPagamento: AgendamentoPagamentoDTO) {    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try{          
      await queryRunner.startTransaction();      
      this.agendamentoPagamentoRepository.save(agendamentoPagamento);
      await queryRunner.commitTransaction();
    }catch(e){
      await queryRunner.rollbackTransaction();
    }finally{
      await queryRunner.release();
    }
  }

}