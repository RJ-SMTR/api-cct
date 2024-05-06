import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ItemTransacaoAgrupado } from 'src/cnab/entity/pagamento/item-transacao-agrupado.entity';
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
} from 'typeorm';
import { ItemTransacaoDTO } from '../../dto/pagamento/item-transacao.dto';

@Injectable()
export class ItemTransacaoAgrupadoRepository {
  private logger: Logger = new Logger(ItemTransacaoAgrupadoRepository.name, {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ItemTransacaoAgrupado)
    private itemTransacaoRepository: Repository<ItemTransacaoAgrupado>,
  ) {}

  /**
   * Bulk update
   */
  public async updateMany(
    dtos: DeepPartial<ItemTransacaoAgrupado>[],
  ): Promise<InsertResult> {
    return this.itemTransacaoRepository.upsert(dtos, {
      skipUpdateIfNoValuesChanged: true,
      conflictPaths: { id: true },
    });
  }

  public async update(id: number, dto: DeepPartial<ItemTransacaoAgrupado>) {
    await this.itemTransacaoRepository.update({ id: id }, dto);
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
    return this.itemTransacaoRepository.insert(dtos);
  }

  public async save(
    itemTransacao: DeepPartial<ItemTransacaoAgrupado>,
  ): Promise<ItemTransacaoAgrupado> {
    return await this.itemTransacaoRepository.save(itemTransacao);
  }

  public async saveDTO(
    itemTransacao: ItemTransacaoDTO,
  ): Promise<ItemTransacaoAgrupado> {
    await validateDTO(ItemTransacaoDTO, itemTransacao);
    return await this.itemTransacaoRepository.save(itemTransacao);
  }

  public async findOne(
    options: FindOneOptions<ItemTransacaoAgrupado>,
  ): Promise<ItemTransacaoAgrupado | null> {
    return (await this.itemTransacaoRepository.find(options)).shift() || null;
  }

  public async findAll(): Promise<ItemTransacaoAgrupado[]> {
    return await this.itemTransacaoRepository.find();
  }

  public async findMany(
    options: FindManyOptions<ItemTransacaoAgrupado>,
  ): Promise<ItemTransacaoAgrupado[]> {
    return await this.itemTransacaoRepository.find(options);
  }
}
