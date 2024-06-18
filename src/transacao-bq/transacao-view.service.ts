import { Injectable } from '@nestjs/common';
import { getChunks, groupBy } from 'src/utils/array-utils';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DataSource, DeepPartial, FindManyOptions, In } from 'typeorm';
import { TransacaoView } from './transacao-view.entity';
import { TransacaoViewRepository } from './transacao-view.repository';
import { IPreviousDaysArgs } from './interfaces/previous-days-args';

@Injectable()
export class TransacaoViewService {
  private logger = new CustomLogger(TransacaoViewService.name, {
    timestamp: true,
  });

  constructor(
    private transacaoViewRepository: TransacaoViewRepository,
    private dataSource: DataSource,
  ) {}

  async count(fields?: EntityCondition<TransacaoView>) {
    return await this.transacaoViewRepository.count(fields);
  }

  save = this.transacaoViewRepository.save;

 async findPreviousDays(args: IPreviousDaysArgs) {
   return await this.transacaoViewRepository.findPreviousDays(args);
  }

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
    return await this.transacaoViewRepository.upsertById(dtos, {
      conflictPaths: {
        id: true,
      },
    });
  }

  async updateMany(ids: number[], dto: DeepPartial<TransacaoView>) {
    await this.transacaoViewRepository.updateMany(ids, dto);
  }

  /**
   * Tarefas:
   * 1. Faz paginação de cada i
   */
  async findExisting(
    transacoes: DeepPartial<TransacaoView>[],
    callback: (existing: TransacaoView[]) => void,
  ) {
    // const len = await this.transacaoViewRepository.count();
    // for (let i = 0; i < len; i += chunkSize) {
    const existing = await this.transacaoViewRepository.findExisting(
      transacoes ,
    );
    callback(existing);
    // }
  }

  /**
   * Tarefas:
   * 1. Atualizar separadamente os campos: valor_pago e tipo_transacao (smtr)
   * 2. Para cada campo, agrupar pelo valor - para fazer um updateMany
   * 3. Separar cada update em chunks para não sobrecarregar
   */
  async saveMany(
    existings: TransacaoView[],
    transacoes: DeepPartial<TransacaoView>[],
  ) {
    this.logger.log(
      `Há Atualizando ou inserindo ${transacoes.length} ` +
        `TransacaoVies, há ${existings.length} existentes...`,
    );
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      let index = 1;
      let maxId = await this.transacaoViewRepository.getMaxId();
      for (const item of transacoes) {
        const existing = existings.filter(
          (i) => i.idTransacao === item.idTransacao,
        )[0] as TransacaoView | undefined;
        if (existing) {
          this.logger.debug(
            `Atualizando item ${existing.id} - ${index}/${transacoes.length}`,
          );
          await queryRunner.manager.save(TransacaoView, {
            id: existing.id,
            ...item,
          });
        } else {
          this.logger.debug(
            `Inserindo novo item - ${index}/${transacoes.length}`,
          );
          item.id = ++maxId;
          await queryRunner.manager.save(TransacaoView, item);
        }
        index++;
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Falha ao salvar ${transacoes.length} TransacaoViews - ${error?.message}`,
        error?.stack,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async updateManyBy(
    existing: DeepPartial<TransacaoView>[],
    property: keyof TransacaoView,
  ) {
    const allProp = existing.filter((i) => i.id && i[property]);
    const groupByProp = groupBy(allProp, property);
    for (const prop of groupByProp) {
      const chunks = getChunks(prop, 100);
      for (const chunk of chunks) {
        const ids = chunk.map((i) => i.id as number);
        await this.transacaoViewRepository.updateMany(ids, {
          [property]: chunk[0][property] as string,
        });
      }
    }
  }

  async insertMany(dtos: DeepPartial<TransacaoView>[]) {
    for (const item of dtos) {
      await this.transacaoViewRepository.save(item);
    }
    // const _dtos = await this.ignoreExisting(structuredClone(dtos));
    // const chunks: TransacaoView[][] = [];
    // while (dtos.length) {
    //   chunks.push(dtos.splice(0, 100));
    // }

    // let count = 1;
    // for (const chunk of chunks) {
    //   this.logger.log(`Inserindo TransacaoViews ${count}/${chunks.length}`);
    //   await this.transacaoViewRepository.insertByDatetime(chunk);
    //   // await this.transacaoViewRepository.upsert(chunk, {
    //   //   conflictPaths: {
    //   //     datetimeTransacao: true,
    //   //     datetimeProcessamento: true,
    //   //   },
    //   // });
    //   count += 1;
    // }
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
