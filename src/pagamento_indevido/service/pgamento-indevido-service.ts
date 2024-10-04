import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityCondition } from "src/utils/types/entity-condition.type";
import { Nullable } from "src/utils/types/nullable.type";
import { DataSource, Repository } from "typeorm";
import { PagamentoIndevido } from "../entity/pagamento-indevido.entity";
import { PagamentoIndevidoDTO } from "../dto/pagamento-indevido.dto";
import { PagamentoIndevidoRepository } from "../repository/pagamento-indevido.repository";

@Injectable()
export class PagamentoIndevidoService {

  
  constructor(
    @InjectRepository(PagamentoIndevido)
    private readonly infoRepository: Repository<PagamentoIndevido>,
    private dataSource: DataSource,
    private pagamentoIndevidoRepository: PagamentoIndevidoRepository
  ) {}

  async find(fields?: EntityCondition<PagamentoIndevido>): Promise<Nullable<PagamentoIndevido[]>> {
    return this.infoRepository.find({
      where: fields,
    });
  }

  async findAll(): Promise<PagamentoIndevidoDTO[]>{
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const rawResult: any[] = await this.dataSource.query(`select * from pagamento_indevido`);  
    await queryRunner.release();        
    return rawResult.map((i) => new PagamentoIndevidoDTO(i)); 
  }

  async save(pagamentoIndevido: PagamentoIndevidoDTO) {    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try{          
      await queryRunner.startTransaction();      
      this.pagamentoIndevidoRepository.save(pagamentoIndevido);
      await queryRunner.commitTransaction();
    }catch(e){
      await queryRunner.rollbackTransaction();
    }finally{
      await queryRunner.release();
    }
  }

}