import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ItemTransacaoAgrupado } from 'src/domain/entity/item-transacao-agrupado.entity';
import { logWarn } from 'src/utils/log-utils';
import { validateDTO } from 'src/utils/validation-utils';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  In,
  InsertResult,
  Repository,
  UpdateResult,
} from 'typeorm';
import { ItemTransacaoDTO } from '../domain/dto/item-transacao.dto';

@Injectable()
export class ItemTransacaoAgrupadoRepository {
  private logger: Logger = new Logger(ItemTransacaoAgrupadoRepository.name, {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ItemTransacaoAgrupado)
    private itemTransacaoAgRepository: Repository<ItemTransacaoAgrupado>,
  ) {}

  public async insertAsNew(
    dto: DeepPartial<ItemTransacaoAgrupado>,
  ): Promise<ItemTransacaoAgrupado> {
    const _dto = structuredClone(dto);
    if (!_dto.id) {
      _dto.id = (await this.getMaxId()) + 1;
    }
    await this.itemTransacaoAgRepository
      .createQueryBuilder()
      .insert()
      .into(ItemTransacaoAgrupado)
      .values([_dto])
      .orIgnore()
      .execute();
    return new ItemTransacaoAgrupado(_dto);
  }

  async getMaxId(): Promise<number> {
    const maxId = await this.itemTransacaoAgRepository
      .createQueryBuilder('t')
      .select('MAX(t.id)', 'max')
      .getRawOne();
    return maxId.max;
  }

  /**
   * Bulk update
   */
  public async updateMany(
    ids: number[],
    set: DeepPartial<ItemTransacaoAgrupado>,
  ): Promise<UpdateResult> {
    return await this.itemTransacaoAgRepository
      .createQueryBuilder()
      .update(ItemTransacaoAgrupado)
      .set(set)
      .whereInIds(ids)
      .execute();
  }

  public async update(id: number, dto: DeepPartial<ItemTransacaoAgrupado>) {
    await this.itemTransacaoAgRepository.update({ id: id }, dto);
    const updated = await this.itemTransacaoAgRepository.findOneOrFail({
      where: {
        id: id,
      },
    });
    return updated;
  }

  /**
   * Bulk save if not exists
   */
  public async saveManyIfNotExists(
    dtos: DeepPartial<ItemTransacaoAgrupado>[],
  ): Promise<ItemTransacaoAgrupado[]> {
    // Existing
    const existing = await this.findMany({
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
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} ItemTransacaoAgrupados já existem, nada a fazer...`,
      );
    } else if (existing.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} ItemTransacaoAgrupados já existem, ignorando...`,
      );
      return [];
    }
    // Save new
    const newItems = dtos.filter(
      (i) => !existingMap[ItemTransacaoAgrupado.getUniqueIdJae(i)],
    );
    const insert = await this.insert(newItems);
    // Return saved
    const insertIds = (insert.identifiers as { id: number }[]).reduce(
      (l, i) => [...l, i.id],
      [],
    );
    const savedItems = await this.findMany({ where: { id: In(insertIds) } });
    return savedItems;
  }

  /**
   * Bulk save
   */
  public async insert(
    dtos: DeepPartial<ItemTransacaoAgrupado>[],
  ): Promise<InsertResult> {
    return this.itemTransacaoAgRepository.insert(dtos);
  }

  public async save(
    itemTransacao: DeepPartial<ItemTransacaoAgrupado>,
  ): Promise<ItemTransacaoAgrupado> {
    return await this.itemTransacaoAgRepository.save(itemTransacao);
  }

  public async saveDTO(
    itemTransacao: ItemTransacaoDTO,
  ): Promise<ItemTransacaoAgrupado> {
    await validateDTO(ItemTransacaoDTO, itemTransacao);
    return await this.itemTransacaoAgRepository.save(itemTransacao);
  }

  public async findOne(
    options: FindOneOptions<ItemTransacaoAgrupado>,
  ): Promise<ItemTransacaoAgrupado | null> {
    return (await this.itemTransacaoAgRepository.find(options)).shift() || null;
  }

  public async findAll(): Promise<ItemTransacaoAgrupado[]> {
    return await this.itemTransacaoAgRepository.find();
  }

  public async findMany(
    options: FindManyOptions<ItemTransacaoAgrupado>,
  ): Promise<ItemTransacaoAgrupado[]> {
    return await this.itemTransacaoAgRepository.find(options);
  }
}
