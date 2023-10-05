import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { bankSeedData } from './bank-seed-data';
import { Bank } from 'src/banks/entities/bank.entity';

@Injectable()
export class BankSeedService {
  constructor(
    @InjectRepository(Bank)
    private repository: Repository<Bank>,
  ) {}

  async run() {
    let id = 1;
    for (const item of bankSeedData) {
      const count = await this.repository.count({
        where: {
          ispb: item.ispb,
        },
      });

      if (!count) {
        await this.repository.save(
          this.repository.create({
            id: id,
            ispb: item.ispb,
            code: item.code,
            name: item.name,
            fullName: item.fullName,
            isAllowed: true,
          }),
        );
      }
      id++;
    }
  }
}
