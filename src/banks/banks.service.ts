import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bank } from './entities/bank.entity';
import { Nullable } from 'src/utils/types/nullable.type';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';

@Injectable()
export class BanksService {
  constructor(
    @InjectRepository(Bank)
    private readonly banksRepository: Repository<Bank>,
  ) {}

  public async getAllowedBanks(): Promise<Bank[]> {
    return this.banksRepository.find({ where: { isAllowed: true } });
  }

  public findMany(fields: EntityCondition<Bank>): Promise<Bank[]> {
    return this.banksRepository.find({
      where: fields,
    });
  }

  public findOne(fields: EntityCondition<Bank>): Promise<Nullable<Bank>> {
    return this.banksRepository.findOne({
      where: fields,
    });
  }

  public async getOne(fields: EntityCondition<Bank>): Promise<Bank> {
    const bank = await this.banksRepository.findOne({
      where: fields,
    });
    if (!bank) {
      const values = Object.values(fields).join(' or ');
      throw CommonHttpException.notFound(
        values ? `Bank.${values}` : 'any Bank',
      );
    }
    return bank;
  }
}
