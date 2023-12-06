import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { bankData } from './bank-seed-data';
import { Bank } from 'src/banks/entities/bank.entity';

@Injectable()
export class BankSeedService {
  constructor(
    @InjectRepository(Bank)
    private repository: Repository<Bank>,
  ) {}

  async run() {
    const items = bankData
      .filter((i) => !isNaN(i.ispb))
      .map((item, index) =>
        this.repository.create({
          id: index + 1,
          ispb: item.ispb,
          code: item.code,
          name: item.name,
          fullName: item.fullName,
          isAllowed: true,
        }),
      );
    await this.repository.clear();
    await this.repository.insert(items);
  }
}
