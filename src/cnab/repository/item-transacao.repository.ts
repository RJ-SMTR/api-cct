import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';
import { ItemTransacao } from '../entity/item-transacao.entity';
import { ItemTransacaoDTO } from '../dto/item-transacao.dto';

@Injectable()
export class ItemTransacaoRepository {
  
  private logger: Logger = new Logger('ItemTransacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ItemTransacao)
    private itemtransacaoRepository: Repository<ItemTransacao>,
  ) {}

  public async save(itemTransacao: ItemTransacaoDTO): Promise<ItemTransacao> {
    return await this.itemtransacaoRepository.save(itemTransacao);
  }

  public async findOne(
    fields: EntityCondition<ItemTransacao> | EntityCondition<ItemTransacao>[],
  ): Promise<Nullable<ItemTransacao>> {
    return await this.itemtransacaoRepository.findOne({
      where: fields,
    });
  }


  public async findAll(): Promise<ItemTransacao[]> {
    return await this.itemtransacaoRepository.find();
  }
}