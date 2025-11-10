import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityCondition } from "src/utils/types/entity-condition.type";
import { Nullable } from "src/utils/types/nullable.type";
import { DataSource, Repository } from "typeorm";
import { AprovacaoPagamentoDTO } from "../domain/dto/aprovacao-pagamento.dto";
import { AprovacaoPagamento } from "../domain/entity/aprovacao-pagamento.entity";
import { AprovacaoPagamentoRepository } from "../repository/aprovacao-pagamento.repository";

@Injectable()
export class AprovacaoPagamentoService {
  
  constructor(
    @InjectRepository(AprovacaoPagamento)
    private readonly infoRepository: Repository<AprovacaoPagamento>,
    private dataSource: DataSource,
    private aprovacaoPagamentoRepository: AprovacaoPagamentoRepository
  ) {}

  async find(fields?: EntityCondition<AprovacaoPagamento>): Promise<Nullable<AprovacaoPagamento[]>> {
    return this.infoRepository.find({
      where: fields,
    });
  }

  async findAll(){
     return this.aprovacaoPagamentoRepository.findAll();
  } 

  async save(aprovacaoPagamento: AprovacaoPagamentoDTO) {    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try{          
      await queryRunner.startTransaction();      
      this.aprovacaoPagamentoRepository.save(aprovacaoPagamento);
      await queryRunner.commitTransaction();
    }catch(e){
      await queryRunner.rollbackTransaction();
    }finally{
      await queryRunner.release();
    }
  }
}