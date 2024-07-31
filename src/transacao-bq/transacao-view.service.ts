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

  async findPreviousDays(args: IPreviousDaysArgs) {
    return await this.transacaoViewRepository.findPreviousDays(args);
  }

  async find(fields: EntityCondition<TransacaoView>, eager = true) {
    return await this.transacaoViewRepository.find({
      where: fields,
      order: {
        datetimeProcessamento: 'DESC',
        datetimeTransacao: 'DESC',
      },
      loadEagerRelations: eager,
    });
  }

  async findRaw(options: FindManyOptions<TransacaoView>) {
    return await this.transacaoViewRepository.find(options);
  }

  /**
   * Tarefas:
   * 1. Faz paginação de cada i
   */
  async findExisting(
    transacoes: DeepPartial<TransacaoView>[],
    callback: (
      existing: TransacaoView[],
      newItems: DeepPartial<TransacaoView>[],
    ) => void,
  ) {
    const existing = await this.transacaoViewRepository.findExisting(
      transacoes,
    );
    const existingIds = existing.map((i) => i.idTransacao);
    const newItems = transacoes.filter(
      (i) => i?.idTransacao && existingIds.includes(i.idTransacao),
    );
    callback(existing, newItems);
  }

  public async save(transacao: TransacaoView){
    await this.transacaoViewRepository.save(transacao);
  }

  /**
   * Cria ou atualiza TransacaoViews
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
      let transacoesIndex = 1;
      let maxId = await this.transacaoViewRepository.getMaxId();
      for (const transacao of transacoes) {
        const existing = existings.filter(
          (i) => i.idTransacao === transacao.idTransacao,
        )[0] as TransacaoView | undefined;
        // Se existe, atualiza
        if (existing) {
          this.logger.debug(
            `Atualizando item ${existing.id} - ${transacoesIndex}/${transacoes.length}`,
          );
          await queryRunner.manager.save(TransacaoView, {
            id: existing.id,
            ...transacao,
          });
        }
        // Senão, cria
        else {
          this.logger.debug(
            `Inserindo novo item - ${transacoesIndex}/${transacoes.length}`,
          );
          transacao.id = ++maxId;
          await queryRunner.manager.save(TransacaoView, transacao);
        }
        transacoesIndex++;
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
}
