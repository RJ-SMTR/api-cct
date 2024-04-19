import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bank } from './entities/bank.entity';
import { NullableType } from 'src/utils/types/nullable.type';
import { EntityCondition } from 'src/utils/types/entity-condition.type';

@Injectable()
export class BanksService {
  constructor(
    @InjectRepository(Bank)
    private readonly banksRepository: Repository<Bank>,
  ) {}

  async getAllowedBanks(): Promise<Bank[]> {
    return this.banksRepository.find({ where: { isAllowed: true } });
  }

  public findMany(fields: EntityCondition<Bank>): Promise<Bank[]> {
    return this.banksRepository.find({
      where: fields,
    });
  }

  findOne(fields: EntityCondition<Bank>): Promise<NullableType<Bank>> {
    return this.banksRepository.findOne({
      where: fields,
    });
  }
}
