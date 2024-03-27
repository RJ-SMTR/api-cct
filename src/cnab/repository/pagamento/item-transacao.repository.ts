import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial, FindManyOptions, FindOneOptions, InsertResult, Repository } from 'typeorm';
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
   * Bulk update
   */
  public async updateMany(dtos: DeepPartial<ItemTransacao>[]): Promise<InsertResult> {
    return this.itemTransacaoRepository.upsert(dtos, {
      skipUpdateIfNoValuesChanged: true,
      conflictPaths: { id: true },
    });
  }

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

  public async findMany(options: FindManyOptions<ItemTransacao>): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.find(options);
  }
}