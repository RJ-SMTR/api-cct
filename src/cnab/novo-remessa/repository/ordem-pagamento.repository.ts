import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, Repository } from 'typeorm';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';

@Injectable()
export class OrdemPagamentoRepository {
  private logger = new CustomLogger(OrdemPagamentoRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamento)
    private ordemPagamentoRepository: Repository<OrdemPagamento>,
  ) {}

  public async save(dto: DeepPartial<OrdemPagamento>): Promise<OrdemPagamento> {
    const existing = await this.ordemPagamentoRepository.findOneBy({ id: dto.id });
    if (existing) {
      return existing
    }
    const createdOrdem = this.ordemPagamentoRepository.create(dto);
    return this.ordemPagamentoRepository.save(createdOrdem);
  }

  public async findOne(fields: EntityCondition<OrdemPagamento>): Promise<Nullable<OrdemPagamento>> {
    return await this.ordemPagamentoRepository.findOne({
      where: fields,
    });
  }

  public async findAll(fields: EntityCondition<OrdemPagamento>): Promise<OrdemPagamento[]> {
    return await this.ordemPagamentoRepository.find({
      where: fields,
    });
  }
}
