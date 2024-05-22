import { Injectable } from '@nestjs/common';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DeepPartial } from 'typeorm';
import { TransacaoView } from './transacao-view.entity';
import { TransacaoViewRepository } from './transacao-view.repository';

@Injectable()
export class TransacaoViewService {
  constructor(private transacaoViewRepository: TransacaoViewRepository) {}

  save = this.transacaoViewRepository.save;

  async find(fields: EntityCondition<TransacaoView>) {
    return await this.transacaoViewRepository.find({
      where: fields,
    });
  }

  findOne = this.transacaoViewRepository.findOne;
  getOne = this.transacaoViewRepository.getOne;

  async upsertId(dtos: TransacaoView[]) {
    return await this.transacaoViewRepository.upsert(dtos, {
      conflictPaths: {
        id: true,
      },
    });
  }

  async updateMany(ids: number[], update: DeepPartial<TransacaoView>) {
    return await this.transacaoViewRepository.updateMany(ids, update);
  }

  async insertMany(dtos: TransacaoView[]) {
    return await this.transacaoViewRepository.upsert(dtos, {
      conflictPaths: {
        datetimeProcessamento: true,
      },
    });
  }
}
