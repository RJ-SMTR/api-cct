import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DeepPartial, FindManyOptions, In } from 'typeorm';
import { TransacaoView } from './transacao-view.entity';
import { TransacaoViewRepository } from './transacao-view.repository';

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

  async find(fields: EntityCondition<TransacaoView>, eager = true) {
    return await this.transacaoViewRepository.find({
      where: fields,
      order: {
        datetimeProcessamento: 'ASC',
      },
      loadEagerRelations: eager,
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
      chunks.push(_dtos.splice(0, 50));
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
    const ids = dtos.map((i) => i.idTransacao);
    const chunks: string[][] = [];
    while (ids.length) {
      chunks.push(ids.splice(0, 1000));
    }
    const existing: TransacaoView[] = [];
    for (const transacaoIds of chunks) {
      const existingSlice = await this.transacaoViewRepository.find({
        where: {
          idTransacao: In(transacaoIds),
        },
        loadEagerRelations: false,
      });
      existing.push(...existingSlice);
    }
    if (existing.length) {
      const existingIds = existing.map((i) => i.idTransacao);
      const lengthBefore = dtos.length;
      const filtered = dtos.filter((i) => !existingIds.includes(i.idTransacao));
      this.logger.log(
        `Há ${existing.length} TransacaoViews existentes no banco, ignorando antes de inserir... ` +
          `(${lengthBefore} -> ${filtered.length} itens)`,
      );
      return filtered;
    }
    return dtos;
  }
}
