import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Bank } from 'src/banks/entities/bank.entity';
import { Repository } from 'typeorm';

@Injectable()
export class InitSeedService {
  constructor(
    @InjectRepository(Bank)
    private banksRepository: Repository<Bank>,
  ) {}

  async isDbEmpty(): Promise<boolean> {
    const count = await this.banksRepository.count();
    return count === 0;
  }
}
