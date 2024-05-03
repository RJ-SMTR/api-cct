import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import {
  DeepPartial,
  FindManyOptions,
  In,
  InsertResult,
  Not,
  Repository,
  UpdateResult,
} from 'typeorm';
import { TransacaoStatusEnum } from '../../enums/pagamento/transacao-status.enum';

@Injectable()
export class TransacaoAgrupadoRepository {
  private logger: Logger = new Logger(TransacaoAgrupadoRepository.name, {
    timestamp: true,
  });

  constructor(
    @InjectRepository(TransacaoAgrupado)
    private transacaoAgRepository: Repository<TransacaoAgrupado>,
  ) {}

  /**
   * Save Transacao if NSA not exists
   *
   * @returns All saved Transacao that not exists
   */
  public async saveManyIfNotExists(
    dtos: DeepPartial<TransacaoAgrupado>[],
  ): Promise<TransacaoAgrupado[]> {
    const METHOD = this.saveManyIfNotExists.name;
    // Existing
    const transacaoUniqueIds = dtos.reduce(
      (l, i) => [...l, ...(i.idOrdemPagamento ? [i.idOrdemPagamento] : [])],
      [],
    );
    const existing = await this.findMany({
      where: { idOrdemPagamento: In(transacaoUniqueIds) },
    });
    const existingMap: Record<string, TransacaoAgrupado> = existing.reduce(
      (m, i) => ({ ...m, [TransacaoAgrupado.getUniqueId(i)]: i }),
      {},
    );
    // Check
    if (existing.length === dtos.length) {
      this.logger.warn(
        `${existing.length}/${dtos.length} Transacoes já existem, nada a fazer...`,
        METHOD,
      );
    } else if (existing.length) {
      this.logger.warn(
        `${existing.length}/${dtos.length} Transacoes já existem, ignorando...`,
        METHOD,
      );
      return [];
    }
    // Save new
    const newDTOs = dtos.filter(
      (i) => !existingMap[TransacaoAgrupado.getUniqueId(i)],
    );
    const inserted = await this.transacaoAgRepository.insert(newDTOs);
    // Return saved
    const insertedIds = (inserted.identifiers as { id: number }[]).reduce(
      (l, i) => [...l, i.id],
      [],
    );
    return await this.findMany({ where: { id: In(insertedIds) } });
  }

  /**
   * Bulk update
   */
  public async updateMany(
    ids: number[],
    set: DeepPartial<TransacaoAgrupado>,
  ): Promise<UpdateResult> {
    const result = await this.transacaoAgRepository
      .createQueryBuilder()
      .update(TransacaoAgrupado)
      .set(set)
      .whereInIds(ids)
      .execute();
    return result;
  }

  /**
   * Bulk save
   */
  public async insert(
    dtos: DeepPartial<TransacaoAgrupado>[],
  ): Promise<InsertResult> {
    return this.transacaoAgRepository.insert(dtos);
  }

  public async update(id: number, dto: DeepPartial<TransacaoAgrupado>) {
    return this.transacaoAgRepository.update(id, dto);
  }

  public async save(
    dto: DeepPartial<TransacaoAgrupado>,
  ): Promise<TransacaoAgrupado> {
    return this.transacaoAgRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<TransacaoAgrupado>,
  ): Promise<Nullable<TransacaoAgrupado>> {
    return await this.transacaoAgRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    options: FindManyOptions<TransacaoAgrupado>,
  ): Promise<TransacaoAgrupado[]> {
    return await this.transacaoAgRepository.find(options);
  }

  public async findAll(): Promise<TransacaoAgrupado[]> {
    return await this.transacaoAgRepository.find({});
  }

  public async getAll(): Promise<TransacaoAgrupado[]> {
    return await this.transacaoAgRepository.find({});
  }

  /**
   * Get all transacao where id not exists in headerArquivo yet (new CNABS)
   */
  public async findAllNewTransacao(): Promise<TransacaoAgrupado[]> {
    return await this.transacaoAgRepository.find({
      where: {
        status: { id: Not(TransacaoStatusEnum.remessaSent) },
      },
    });
  }
}
