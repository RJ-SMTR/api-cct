import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
import { Transacao } from '../../entity/pagamento/transacao.entity';
import { TransacaoStatusEnum } from '../../enums/pagamento/transacao-status.enum';
import { PagadorContaEnum } from 'src/cnab/enums/pagamento/pagador.enum';

@Injectable()
export class TransacaoRepository {
  private logger: Logger = new Logger('TransacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(Transacao)
    private transacaoRepository: Repository<Transacao>,
  ) {}

  /**
   * Save Transacao if NSA not exists
   *
   * @returns All saved Transacao that not exists
   */
  public async saveManyIfNotExists(
    dtos: DeepPartial<Transacao>[],
  ): Promise<Transacao[]> {
    const METHOD = this.saveManyIfNotExists.name;
    // Existing
    const transacaoUniqueIds = dtos.reduce(
      (l, i) => [...l, ...(i.idOrdemPagamento ? [i.idOrdemPagamento] : [])],
      [],
    );
    const existing = await this.findMany({
      where: { idOrdemPagamento: In(transacaoUniqueIds) },
    });
    const existingMap: Record<string, Transacao> = existing.reduce(
      (m, i) => ({ ...m, [Transacao.getUniqueId(i)]: i }),
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
    const newDTOs = dtos.filter((i) => !existingMap[Transacao.getUniqueId(i)]);
    const inserted = await this.transacaoRepository.insert(newDTOs);
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
    set: DeepPartial<Transacao>,
  ): Promise<UpdateResult> {
    const result = await this.transacaoRepository
      .createQueryBuilder()
      .update(Transacao)
      .set(set)
      .whereInIds(ids)
      .execute();
    return result;
  }

  /**
   * Bulk save
   */
  public async insert(dtos: DeepPartial<Transacao>[]): Promise<InsertResult> {
    return this.transacaoRepository.insert(dtos);
  }

  public async update(id: number, dto: DeepPartial<Transacao>) {
    return this.transacaoRepository.update(id, dto);
  }

  public async save(dto: DeepPartial<Transacao>): Promise<Transacao> {
    return this.transacaoRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<Transacao>,
  ): Promise<Nullable<Transacao>> {
    return await this.transacaoRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    options: FindManyOptions<Transacao>,
  ): Promise<Transacao[]> {
    return await this.transacaoRepository.find(options);
  }

  public async findAll(): Promise<Transacao[]> {
    return await this.transacaoRepository.find({});
  }

  public async getAll(): Promise<Transacao[]> {
    return await this.transacaoRepository.find({});
  }

  /**
   * Get all transacao where id not exists in headerArquivo yet (new CNABS)
   */
  public async findAllNewTransacao(): Promise<Transacao[]> {
    return await this.transacaoRepository.find({
      where: {
        status: { id: Not(TransacaoStatusEnum.remessaSent) },
        pagador: { conta: PagadorContaEnum.CETT },
      },
    });
  }
}
