import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { asString } from 'src/utils/pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial, FindManyOptions, In, InsertResult, Not, Repository, UpdateResult } from 'typeorm';
import { TransacaoDTO } from '../../dto/pagamento/transacao.dto';
import { Transacao } from '../../entity/pagamento/transacao.entity';
import { TransacaoStatusEnum } from '../../enums/pagamento/transacao-status.enum';

@Injectable()
export class TransacaoRepository {
  private logger: Logger = new Logger('TransacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(Transacao)
    private transacaoRepository: Repository<Transacao>,
  ) { }

  /**
   * Save Transacao if NSA not exists
   * 
   * @returns All saved Transacao that not exists
   */
  public async saveManyIfNotExists(dtos: DeepPartial<Transacao>[]): Promise<Transacao[]> {
    const METHOD = this.saveManyIfNotExists.name;
    // Existing
    const transacaoUniqueIds =
      dtos.reduce((l, i) => [...l, ...i.idOrdemPagamento ? [i.idOrdemPagamento] : []], []);
    const existing = await this.findMany({ where: { idOrdemPagamento: In(transacaoUniqueIds) } });
    const existingMap: Record<string, Transacao> =
      existing.reduce((m, i) => ({ ...m, [Transacao.getUniqueId(i)]: i }), {});
    // Check
    if (existing.length === dtos.length) {
      this.logger.warn(`${existing.length}/${dtos.length} Transacoes já existem, nada a fazer...`, METHOD);
    } else if (existing.length) {
      this.logger.warn(`${existing.length}/${dtos.length} Transacoes já existem, ignorando...`, METHOD);
      return [];
    }
    // Save new
    const newDTOs = dtos.filter(i => !existingMap[Transacao.getUniqueId(i)]);
    const inserted = await this.transacaoRepository.insert(newDTOs);
    // Return saved
    const insertedIds = (inserted.identifiers as { id: number }[]).reduce((l, i) => [...l, i.id], []);
    return await this.findMany({ where: { id: In(insertedIds) } });
  }

  /**
   * Save Transacao if NSA not exists
   */
  public async saveIfNotExists(dto: TransacaoDTO): Promise<SaveIfNotExists<Transacao>> {
    await validateDTO(TransacaoDTO, dto);
    const transacao = await this.findOne({ idOrdemPagamento: asString(dto.idOrdemPagamento) });
    if (transacao) {
      return {
        isNewItem: false,
        item: transacao,
      };
    } else {
      return {
        isNewItem: true,
        item: await this.transacaoRepository.save(dto),
      };
    }
  }

  /**
   * Bulk update
   */
  public async updateMany(ids: number[], set: DeepPartial<Transacao>): Promise<UpdateResult> {
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

  public async save(dto: TransacaoDTO): Promise<Transacao> {
    return this.transacaoRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<Transacao>,
  ): Promise<Nullable<Transacao>> {
    return await this.transacaoRepository.findOne({
      where: fields,
    });
  }

  public async findMany(options: FindManyOptions<Transacao>): Promise<Transacao[]> {
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
        status: { id: Not(TransacaoStatusEnum.remessaSent) }
      }
    });
  }
}
