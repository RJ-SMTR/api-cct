import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';
import { ItemTransacao } from '../entity/item-transacao.entity';
import { ItemTransacaoDTO } from '../dto/item-transacao.dto';
import { validateDTO } from 'src/utils/validation-utils';

@Injectable()
export class ItemTransacaoRepository {

  private logger: Logger = new Logger('ItemTransacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ItemTransacao)
    private itemTransacaoRepository: Repository<ItemTransacao>,
  ) { }

  public async save(itemTransacao: ItemTransacaoDTO): Promise<ItemTransacao> {
    await validateDTO(ItemTransacaoDTO, itemTransacao);
    const itemTransacaoEntity = new ItemTransacao(itemTransacao);
    return await this.itemTransacaoRepository.save(itemTransacaoEntity);
  }

  public async findOne(
    fields: EntityCondition<ItemTransacao> | EntityCondition<ItemTransacao>[],
  ): Promise<Nullable<ItemTransacao>> {
    return await this.itemTransacaoRepository.findOne({
      where: fields,
    });
  }


  public async findAll(): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.find();
  }

  public async findMany(fields: EntityCondition<ItemTransacao> | EntityCondition<ItemTransacao>[]): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.find({ where: fields });
  }
}