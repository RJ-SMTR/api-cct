import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityCondition } from "src/utils/types/entity-condition.type";
import { Nullable } from "src/utils/types/nullable.type";
import { DataSource, Repository } from "typeorm";
import { PagamentoIndevido } from "../entity/pagamento-indevido.entity";
import { PagamentoIndevidoDTO } from "../dto/pagamento-indevido.dto";

@Injectable()
export class PagamentoIndevidoService {
  constructor(
    @InjectRepository(PagamentoIndevido)
    private readonly infoRepository: Repository<PagamentoIndevido>,
    private dataSource: DataSource,
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
    return rawResult.map((i) => new PagamentoIndevidoDTO(i)); 
  }

}