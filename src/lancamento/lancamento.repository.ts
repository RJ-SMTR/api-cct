import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, DeleteResult, FindManyOptions, FindOneOptions, Repository, SaveOptions } from 'typeorm';
import { Lancamento } from './entities/lancamento.entity';

@Injectable()
export class LancamentoRepository {
  constructor(
    @InjectRepository(Lancamento)
    private readonly lancamentoRepository: Repository<Lancamento>,
  ) {}

  create(entityLike: DeepPartial<Lancamento>): Lancamento {
    return this.lancamentoRepository.create(entityLike);
  }

  save(entity: DeepPartial<Lancamento>, options?: SaveOptions): Promise<Lancamento> {
    return this.lancamentoRepository.save(entity, options);
  }

  findOne(options: FindOneOptions<Lancamento>): Promise<Lancamento | null> {
    return this.lancamentoRepository.findOne(options);
  }

  async getOne(where: FindOneOptions<Lancamento>): Promise<Lancamento> {
    const found = await this.lancamentoRepository.findOne(where);
    if (!found) {
      throw new HttpException('Lancamento não encontrado', HttpStatus.NOT_FOUND);
    }
    return found;
  }

  findMany(options?: FindManyOptions<Lancamento> | undefined): Promise<Lancamento[]> {
    return this.lancamentoRepository.find(options);
  }

  getAll(): Promise<Lancamento[]> {
    return this.lancamentoRepository.find();
  }

  delete(id: number): Promise<DeleteResult> {
    return this.lancamentoRepository.delete(id);
  }
}
