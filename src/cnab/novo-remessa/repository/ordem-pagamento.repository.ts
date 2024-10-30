import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, Repository } from 'typeorm';
import { OrdemPagamentoEntity } from '../entity/ordens-pagamento.entity';

@Injectable()
export class OrdemPagamentoRepository {
  private logger = new CustomLogger(OrdemPagamentoRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamentoRepository)
    private ordemPagamentoRepository: Repository<OrdemPagamentoEntity>,
  ) {}

  public async save(dto: DeepPartial<OrdemPagamentoEntity>): Promise<OrdemPagamentoEntity> {
    const createdOrdem = this.ordemPagamentoRepository.create(dto);
    return this.ordemPagamentoRepository.save(createdOrdem);
  }

  public async findOne(fields: EntityCondition<OrdemPagamentoEntity>): Promise<Nullable<OrdemPagamentoEntity>> {
    return await this.ordemPagamentoRepository.findOne({
      where: fields,
    });
  }

  public async findAll(): Promise<OrdemPagamentoEntity[]> {
    return await this.ordemPagamentoRepository.find({});
  }
 
}