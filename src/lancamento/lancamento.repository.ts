import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  DeleteResult,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
  SaveOptions,
} from 'typeorm';
import { LancamentoEntity } from './lancamento.entity';

@Injectable()
export class LancamentoRepository {
  constructor(
    @InjectRepository(LancamentoEntity)
    private readonly lancamentoRepository: Repository<LancamentoEntity>,
  ) {}

  public async update(
    options: FindOptionsWhere<LancamentoEntity>,
    update: DeepPartial<LancamentoEntity>,
  ) {
    return await this.lancamentoRepository.update(options, update);
  }

  create(entityLike: DeepPartial<LancamentoEntity>): LancamentoEntity {
    return this.lancamentoRepository.create(entityLike);
  }

  save(
    entity: DeepPartial<LancamentoEntity>,
    options?: SaveOptions,
  ): Promise<LancamentoEntity> {
    return this.lancamentoRepository.save(entity, options);
  }

  findOne(
    options: FindOneOptions<LancamentoEntity>,
  ): Promise<LancamentoEntity | null> {
    return this.findOne(options);
  }

  findMany(
    options?: FindManyOptions<LancamentoEntity> | undefined,
  ): Promise<LancamentoEntity[]> {
    return this.lancamentoRepository.find(options);
  }

  getAll(): Promise<LancamentoEntity[]> {
    return this.lancamentoRepository.find();
  }

  delete(id: number): Promise<DeleteResult> {
    return this.lancamentoRepository.delete(id);
  }
}
