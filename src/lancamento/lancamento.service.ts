import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItfLancamento } from './interfaces/lancamento.interface';
import { LancamentoEntity } from './lancamento.entity';

@Injectable()
export class LancamentoService {
  constructor(
    @InjectRepository(LancamentoEntity)
    private readonly lancamentoRepository: Repository<LancamentoEntity>,
  ) {}

  // async findById(id: number): Promise<ItfLancamento> {
  //     return await this.lancamentoRepository.findOne(id)!;
  // }

  async create(lancamentoData: ItfLancamento): Promise<ItfLancamento> {
    const newLancamento = this.lancamentoRepository.create(lancamentoData);
    return await this.lancamentoRepository.save(newLancamento);
  }

  //   async update(id: number, updatedData: ItfLancamento): Promise<ItfLancamento> {
  //     await this.lancamentoRepository.update(id, updatedData);
  //     return await this.findById(id);
  //   }

  async delete(id: number): Promise<void> {
    await this.lancamentoRepository.delete(id);
  }
}
