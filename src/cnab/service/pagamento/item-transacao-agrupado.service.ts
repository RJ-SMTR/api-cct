import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ItemTransacaoAgrupado } from 'src/cnab/entity/pagamento/item-transacao-agrupado.entity';
import { ItemTransacaoAgrupadoRepository } from 'src/cnab/repository/pagamento/item-transacao-agrupado.repository';
import { CustomLogger } from 'src/utils/custom-logger';
import {
  DataSource,
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  In,
  QueryRunner,
  UpdateResult,
} from 'typeorm';

@Injectable()
export class ItemTransacaoAgrupadoService {
  private logger: Logger = new CustomLogger(ItemTransacaoAgrupadoService.name, {
    timestamp: true,
  });

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private itemTransacaoAgRepository: ItemTransacaoAgrupadoRepository,
  ) {}

  async getMaxId(): Promise<number> {
    return await this.itemTransacaoAgRepository.getMaxId();
  }

  async findOne(options: FindOneOptions<ItemTransacaoAgrupado>) {
    return await this.itemTransacaoAgRepository.findOne(options);
  }

  /**
   * Use first Transacao as set to update and all Transacoes to get ids.
   */
  public updateMany(
    ids: number[],
    set: DeepPartial<ItemTransacaoAgrupado>,
  ): Promise<UpdateResult> {
    return this.itemTransacaoAgRepository.updateMany(ids, set);
  }

  async update(id: number, dto: DeepPartial<ItemTransacaoAgrupado>) {
    return await this.itemTransacaoAgRepository.update(id, dto);
  }

  /**
   * Bulk save Transacao.
   */
  public async saveMany(
    itens: ItemTransacaoAgrupado[],
  ): Promise<ItemTransacaoAgrupado[]> {
    const insert = await this.itemTransacaoAgRepository.insert(itens);
    const ids: number[] = insert.identifiers.map((i) => i.id);
    if (ids.length === 0) {
      return [];
    }
    const newItens = await this.itemTransacaoAgRepository.findMany({
      where: { id: In(ids) },
    });
    return newItens;
  }

  public async findManyByIdTransacaoAg(
    id_transacao: number,
  ): Promise<ItemTransacaoAgrupado[]> {
    const query = ` select ita.* from item_transacao_agrupado ita `
                + ` where  ita."transacaoAgrupadoId"=${id_transacao} `

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    return result.map((r) => new ItemTransacaoAgrupado(r));    
  }

  public async findMany(options: FindManyOptions<ItemTransacaoAgrupado>) {
    return await this.itemTransacaoAgRepository.findMany(options);
  }

  /**
   * Insert with a new generated id
   */
  public async insert(
    dto: DeepPartial<ItemTransacaoAgrupado>,
  ): Promise<ItemTransacaoAgrupado> {
    return await this.itemTransacaoAgRepository.insertAsNew(dto);
  }

  public async save(
    dto: DeepPartial<ItemTransacaoAgrupado>,queryRunner:QueryRunner
  ): Promise<ItemTransacaoAgrupado> {
    return await queryRunner.manager.getRepository(ItemTransacaoAgrupado).save(dto);
  }

  /**
   * Save if composite unique columns not exist. Otherwise, update.
   */
  public async saveManyIfNotExistsJae(
    dtos: DeepPartial<ItemTransacaoAgrupado>[],
  ): Promise<ItemTransacaoAgrupado[]> {
    // Existing
    const existing = await this.itemTransacaoAgRepository.findMany({
      where: dtos.reduce(
        (l, i) => [
          ...l,
          {
            idOrdemPagamento: i.idOrdemPagamento,
            idOperadora: i.idOperadora,
            idConsorcio: i.idConsorcio,
          } as FindOptionsWhere<ItemTransacaoAgrupado>,
        ],
        [],
      ),
    });
    const existingMap: Record<string, ItemTransacaoAgrupado> = existing.reduce(
      (m, i) => ({ ...m, [ItemTransacaoAgrupado.getUniqueIdJae(i)]: i }),
      {},
    );

    // Check
    if (existing.length === dtos.length) {
      this.logger.warn(
        `${existing.length}/${dtos.length} ItemTransacoes já existem, nada a fazer...`,
      );
    } else if (existing.length) {
      this.logger.warn(
        `${existing.length}/${dtos.length} ItemTransacoes já existem, ignorando...`,
      );
      return [];
    }

    // Save new
    const newItems = dtos.filter(
      (i) => !existingMap[ItemTransacaoAgrupado.getUniqueIdJae(i)],
    );
    const insert = await this.itemTransacaoAgRepository.insert(newItems);

    // Return saved
    const insertIds = (insert.identifiers as { id: number }[]).reduce(
      (l, i) => [...l, i.id],
      [],
    );
    const savedItems = await this.itemTransacaoAgRepository.findMany({
      where: { id: In(insertIds) },
    });
    return savedItems;
  }

  public async getOldestDate(): Promise<Date | null> {
    return (
      (
        await this.itemTransacaoAgRepository.findOne({
          order: {
            dataOrdem: 'ASC',
          },
        })
      )?.dataOrdem || null
    );
  }
}
