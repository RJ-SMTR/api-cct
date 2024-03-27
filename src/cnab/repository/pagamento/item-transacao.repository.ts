import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial, FindOneOptions, InsertResult, Repository } from 'typeorm';
import { ItemTransacaoDTO } from '../../dto/pagamento/item-transacao.dto';
import { ItemTransacao } from '../../entity/pagamento/item-transacao.entity';

@Injectable()
export class ItemTransacaoRepository {

  private logger: Logger = new Logger('ItemTransacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ItemTransacao)
    private itemTransacaoRepository: Repository<ItemTransacao>,
  ) { }

  /**
   * Bulk save
   */
  public async insert(dtos: DeepPartial<ItemTransacao>[]): Promise<InsertResult> {
    return this.itemTransacaoRepository.insert(dtos);
  }
  
  public async save(itemTransacao: DeepPartial<ItemTransacao>): Promise<ItemTransacao> {
    return await this.itemTransacaoRepository.save(itemTransacao);
  }

  public async saveDTO(itemTransacao: ItemTransacaoDTO): Promise<ItemTransacao> {
    await validateDTO(ItemTransacaoDTO, itemTransacao);
    return await this.itemTransacaoRepository.save(itemTransacao);
  }

  public async findOne(options: FindOneOptions<ItemTransacao>): Promise<Nullable<ItemTransacao>> {
    return (await this.itemTransacaoRepository.find(options)).shift() || null;
  }

  public async findAll(): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.find();
  }

  public async findMany(fields: EntityCondition<ItemTransacao> | EntityCondition<ItemTransacao>[]): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.find({ where: fields });
  }
}