import { Injectable } from '@nestjs/common';
import { TransacaoView } from './transacao-view.entity';
import { DeepPartial, FindManyOptions, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TransacaoViewRepository {
  constructor(
    @InjectRepository(TransacaoView)
    private transacaoViewRepository: Repository<TransacaoView>,
  ) {}

  public save(dto: DeepPartial<TransacaoView>): Promise<TransacaoView> {
    return this.transacaoViewRepository.save(dto);
  }

  public async upsert(dtos: DeepPartial<TransacaoView>[]) {
    return await this.transacaoViewRepository.upsert(dtos, {
      conflictPaths: {
        datetimeProcessamento: true,
      },
    });
  }

  public async getOne(
    options: FindManyOptions<TransacaoView>,
  ): Promise<TransacaoView> {
    return await this.transacaoViewRepository.findOneOrFail(options);
  }

  public async findMany(
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
}
