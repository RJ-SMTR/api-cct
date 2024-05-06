import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  In,
  InsertResult,
  Repository,
} from 'typeorm';
import { ItemTransacaoDTO } from '../../dto/pagamento/item-transacao.dto';
import { ItemTransacao } from '../../entity/pagamento/item-transacao.entity';
import { logWarn } from 'src/utils/log-utils';

@Injectable()
export class ItemTransacaoRepository {
  private logger: Logger = new Logger('ItemTransacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ItemTransacao)
    private itemTransacaoRepository: Repository<ItemTransacao>,
  ) {}

  /**
   * Bulk update
   */
  public async updateMany(
    dtos: DeepPartial<ItemTransacao>[],
  ): Promise<InsertResult> {
    return this.itemTransacaoRepository.upsert(dtos, {
      skipUpdateIfNoValuesChanged: true,
      conflictPaths: { id: true },
    });
  }

  public async update(id: number, dto: DeepPartial<ItemTransacao>) {
    await this.itemTransacaoRepository.update(
      { id: id },
      dto,
    );
    const updated = await this.itemTransacaoRepository.findOneOrFail({
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
    dtos: DeepPartial<ItemTransacao>[],
  ): Promise<ItemTransacao[]> {
    // Existing
    const existing = await this.findMany({
      where: dtos.reduce(
        (l, i) => [
          ...l,
          {
            idOrdemPagamento: i.idOrdemPagamento,
            idOperadora: i.idOperadora,
            idConsorcio: i.idConsorcio,
          } as FindOptionsWhere<ItemTransacao>,
        ],
        [],
      ),
    });
    const existingMap: Record<string, ItemTransacao> = existing.reduce(
      (m, i) => ({ ...m, [ItemTransacao.getUniqueIdJae(i)]: i }),
      {},
    );
    // Check
    if (existing.length === dtos.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} ItemTransacoes já existem, nada a fazer...`,
      );
    } else if (existing.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} ItemTransacoes já existem, ignorando...`,
      );
      return [];
    }
    // Save new
    const newItems = dtos.filter(
      (i) => !existingMap[ItemTransacao.getUniqueIdJae(i)],
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
    dtos: DeepPartial<ItemTransacao>[],
  ): Promise<InsertResult> {
    return this.itemTransacaoRepository.insert(dtos);
  }

  public async save(
    itemTransacao: DeepPartial<ItemTransacao>,
  ): Promise<ItemTransacao> {
    return await this.itemTransacaoRepository.save(itemTransacao);
  }

  public async saveDTO(
    itemTransacao: ItemTransacaoDTO,
  ): Promise<ItemTransacao> {
    await validateDTO(ItemTransacaoDTO, itemTransacao);
    return await this.itemTransacaoRepository.save(itemTransacao);
  }

  public async findOne(
    options: FindOneOptions<ItemTransacao>,
  ): Promise<Nullable<ItemTransacao>> {
    return (await this.itemTransacaoRepository.find(options)).shift() || null;
  }

  public async findAll(): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.find();
  }

  public async findMany(
    options: FindManyOptions<ItemTransacao>,
  ): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.find(options);
  }
}
