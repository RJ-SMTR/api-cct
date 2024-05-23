import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindManyOptions, Repository } from 'typeorm';
import { UpsertOptions } from 'typeorm/repository/UpsertOptions';
import { TransacaoView } from './transacao-view.entity';
import { EntityCondition } from 'src/utils/types/entity-condition.type';

@Injectable()
export class TransacaoViewRepository {
  constructor(
    @InjectRepository(TransacaoView)
    private transacaoViewRepository: Repository<TransacaoView>,
  ) {}

  async count(fields?: EntityCondition<TransacaoView>) {
    if (fields) {
      return await this.transacaoViewRepository.countBy(fields);
    } else {
      return await this.transacaoViewRepository.count();
    }
  }

  public save(dto: DeepPartial<TransacaoView>): Promise<TransacaoView> {
    return this.transacaoViewRepository.save(dto);
  }

  public async upsert(
    dtos: DeepPartial<TransacaoView>[],
    conditions: UpsertOptions<TransacaoView>,
  ) {
    return await this.transacaoViewRepository.upsert(dtos, conditions);
  }

  public async getOne(
    options: FindManyOptions<TransacaoView>,
  ): Promise<TransacaoView> {
    return await this.transacaoViewRepository.findOneOrFail(options);
  }

  public async find(
    options: FindManyOptions<TransacaoView>,
  ): Promise<TransacaoView[]> {
    return await this.transacaoViewRepository.find(options);
  }

  public async findOne(
    options: FindManyOptions<TransacaoView>,
  ): Promise<TransacaoView | null> {
    const many = await this.transacaoViewRepository.find(options);
    return many.pop() || null;
  }

  async updateMany(ids: number[], dto: DeepPartial<TransacaoView>) {
    await this.transacaoViewRepository
      .createQueryBuilder('t')
      .update()
      .set(dto)
      .whereInIds(ids)
      .execute();
  }

  createQueryBuilder = this.transacaoViewRepository.createQueryBuilder;
}
