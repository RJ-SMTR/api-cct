import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItfLancamento } from './interfaces/lancamento.interface';
import { LancamentoEntity } from './lancamento.entity';
import { Between } from 'typeorm';

@Injectable()
export class LancamentoService {
  constructor(
    @InjectRepository(LancamentoEntity)
    private readonly lancamentoRepository: Repository<LancamentoEntity>,
  ) {}

  async findByPeriod(
    month: number,
    period: number,
    year: number,
  ): Promise<ItfLancamento[]> {
    const [startDate, endDate] = this.getMonthDateRange(year, month, period);
    return await this.lancamentoRepository.find({
      where: {
        data_ordem: Between(startDate, endDate),
      },
    });
  }

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

  getMonthDateRange(year: number, month: number, period: number): [Date, Date] {
    let startDate: Date;
    let endDate: Date;

    if (period === 1) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month - 1, 15);
    } else if (period === 2) {
      startDate = new Date(year, month - 1, 16);
      endDate = new Date(year, month, 0);
    } else {
      throw new Error('Invalid period. Period should be 1 or 2.');
    }
    return [startDate, endDate];
  }
}
