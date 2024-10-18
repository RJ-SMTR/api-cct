import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DeepPartial, EntityManager, FindManyOptions, QueryRunner } from 'typeorm';
import { IPreviousDaysArgs } from './interfaces/previous-days-args';
import { ITransacaoView, TransacaoView } from './transacao-view.entity';
import { TVFindUpdateValuesWhere, TransacaoViewFindRawOptions, TransacaoViewRepository } from './transacao-view.repository';
import { IClearSyncOrdemPgto, ISyncOrdemPgto } from './interfaces/sync-transacao-ordem.interface';

@Injectable()
export class TransacaoViewService {
  private logger = new CustomLogger(TransacaoViewService.name, { timestamp: true });

  constructor(private transacaoViewRepository: TransacaoViewRepository) {}

  async syncOrdemPgto(args?: ISyncOrdemPgto) {
    return await this.transacaoViewRepository.syncOrdemPgto(args);
  }

  async clearSyncOrdemPgto(args?: IClearSyncOrdemPgto) {
    return await this.transacaoViewRepository.clearSyncOrdemPgto(args);
  }

  async updateManyRaw(
    dtos: DeepPartial<TransacaoView>[], //
    fields: (keyof ITransacaoView)[],
    reference: keyof ITransacaoView,
    manager?: EntityManager,
  ) {
    return await this.transacaoViewRepository.updateManyRaw(dtos, fields, reference, manager);
  }

  async removeDuplicates() {
    return await this.transacaoViewRepository.removeDuplicates();
  }

  async count(fields?: EntityCondition<TransacaoView>) {
    return await this.transacaoViewRepository.count(fields);
  }

  async findPreviousDays(args: IPreviousDaysArgs) {
    return await this.transacaoViewRepository.findPreviousDays(args);
  }

  async find(fields: EntityCondition<TransacaoView>, eager = true, options?: FindManyOptions<TransacaoView>) {
    return await this.transacaoViewRepository.find({
      where: fields,
      order: {
        datetimeProcessamento: 'DESC',
        datetimeTransacao: 'DESC',
        id: 'ASC',
      },
      loadEagerRelations: eager,
      ...(options ? options : {}),
    });
  }

  async findPaginated(fields: EntityCondition<TransacaoView>, limit: number, callback: (items: TransacaoView[], count: number) => void, eager = true) {
    let page = 1;
    let offset = limit * page;
    let [transacoes, count] = await this.transacaoViewRepository.findAndCount({ where: fields, loadEagerRelations: eager, take: limit, skip: offset, order: { datetimeProcessamento: 'DESC', datetimeTransacao: 'DESC', id: 'ASC' } });
    while (transacoes.length) {
      callback(transacoes, count);
      page += 1;
      offset = limit * page;
      [transacoes, count] = await this.transacaoViewRepository.findAndCount({ where: fields, loadEagerRelations: eager, take: limit, skip: offset, order: { datetimeProcessamento: 'DESC', datetimeTransacao: 'DESC', id: 'ASC' } });
    }
  }

  async findCustom(options: FindManyOptions<TransacaoView>) {
    return await this.transacaoViewRepository.find(options);
  }
  async findRaw(where?: TransacaoViewFindRawOptions): Promise<TransacaoView[]> {
    return await this.transacaoViewRepository.findRaw(where);
  }
  async findUpdateValues(where?: TVFindUpdateValuesWhere) {
    return await this.transacaoViewRepository.findUpdateValues(where);
  }

  /**
   * Tarefas:
   * 1. Faz paginação de cada i
   */
  async findExisting(transacoes: DeepPartial<TransacaoView>[], callback: (existing: TransacaoView[], newItems: DeepPartial<TransacaoView>[]) => void) {
    const existing = await this.transacaoViewRepository.findExisting(transacoes);
    const existingIds = existing.map((i) => i.idTransacao);
    const newItems = transacoes.filter((i) => i?.idTransacao && existingIds.includes(i.idTransacao));
    callback(existing, newItems);
  }

  public async save(transacao: TransacaoView, queryRunner: QueryRunner) {
    await queryRunner.manager.getRepository(TransacaoView).save(transacao);
  }

  /**
   * Cria ou atualiza TransacaoViews
   *
   * Usamos este mesmo método para tudo para melhor manutenção do código
   *
   * Tarefas:
   * 1. Atualizar separadamente os campos: valor_pago e tipo_transacao (smtr)
   * 2. Para cada campo, agrupar pelo valor - para fazer um updateMany
   * 3. Separar cada update em chunks para não sobrecarregar
   *
   * @param [existings=[]] verifica se item existe baseado no idTransacao.
   * Se a lsita for vazia, verifica se `transacoes` possui id
   */
  async saveMany(transacoes: DeepPartial<TransacaoView>[], queryRunner: QueryRunner, existings: TransacaoView[] = []) {
    this.logger.log(`Inserindo ${transacoes.length} ` + `TransacaoViews, há ${existings.length} existentes...`);
    let transacoesIndex = 1;
    let maxId = await this.transacaoViewRepository.getMaxId();
    for (const transacao of transacoes) {
      const existing = existings.filter((i) => i.idTransacao === transacao.idTransacao)[0] as TransacaoView | undefined;
      if (!existing) {
        this.logger.debug(`Inserindo novo item - ${transacoesIndex}/${transacoes.length}`);
        transacao.id = ++maxId;
        await queryRunner.manager.getRepository(TransacaoView).save(transacao);
      }
      transacoesIndex++;
    }
  }
}
