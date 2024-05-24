import { Injectable } from '@nestjs/common';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DeepPartial, FindManyOptions, In } from 'typeorm';
import { TransacaoView } from './transacao-view.entity';
import { TransacaoViewRepository } from './transacao-view.repository';
import { CustomLogger } from 'src/utils/custom-logger';

@Injectable()
export class TransacaoViewService {
  private logger = new CustomLogger(TransacaoViewService.name, {
    timestamp: true,
  });

  constructor(private transacaoViewRepository: TransacaoViewRepository) {}

  async count(fields?: EntityCondition<TransacaoView>) {
    return await this.transacaoViewRepository.count(fields);
  }

  save = this.transacaoViewRepository.save;

  async find(fields: EntityCondition<TransacaoView>) {
    return await this.transacaoViewRepository.find({
      where: fields,
    });
  }

  async findRaw(options: FindManyOptions<TransacaoView>) {
    return await this.transacaoViewRepository.find(options);
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
    const _dtos = await this.ignoreExisting(structuredClone(dtos));
    const chunks: TransacaoView[][] = [];
    while (_dtos.length) {
      chunks.push(_dtos.splice(0, 1000));
    }

    let count = 1;
    for (const chunk of chunks) {
      this.logger.log(`Inserindo TransacaoViews ${count}/${chunks.length}`);
      await this.transacaoViewRepository.upsert(chunk, {
        conflictPaths: {
          id: true,
        },
      });
      count += 1;
    }
  }

  async ignoreExisting(dtos: TransacaoView[]) {
    const existing = await this.transacaoViewRepository.find({
      where: {
        id: In(dtos.map((i) => i.datetimeProcessamento)),
      },
    });
    if (existing.length) {
      const existingIds = existing.map((i) => i.id);
      const lengthBefore = dtos.length;
      const filtered = dtos.filter((i) => !existingIds.includes(i.id));
      this.logger.log(
        `Há ${existing.length} TransacaoViews existentes no banco, ignorando antes de inserir... `
        + `(${lengthBefore} -> ${filtered.length} itens)`,
      );
      return filtered;
    }
    return dtos;
  }
}
