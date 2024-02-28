import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import { Repository, UpdateResult } from 'typeorm';
import { TransacaoClienteItem } from '../entity/transacao-cliente-item.entity';
import { CreateTransacaoClienteItemDto } from '../interfaces/transacao-cliente-item/create-transacao-cliente-item.dto';
import { UpdateTransacaoClienteItemDto } from '../interfaces/transacao-cliente-item/update-transacao-cliente-item.dto';

@Injectable()
export class TransacaoClienteItemRepository {
  private logger: Logger = new Logger('TransacaoClienteItemRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(TransacaoClienteItem)
    private TransacaoClienteItemRepository: Repository<TransacaoClienteItem>,
  ) {}

  public async create(
    createProfileDto: CreateTransacaoClienteItemDto,
  ): Promise<TransacaoClienteItem> {
    const createdItem = await this.TransacaoClienteItemRepository.save(
      this.TransacaoClienteItemRepository.create(createProfileDto),
    );
    this.logger.log(`TransacaoClienteItem criado: ${createdItem.getLogInfo()}`);
    return createdItem;
  }

  public async update(
    id: number,
    updateDto: UpdateTransacaoClienteItemDto,
  ): Promise<UpdateResult> {
    const updatePayload = await this.TransacaoClienteItemRepository.update(
      { id_cliente_favorecido: id },
      updateDto,
    );
    return updatePayload;
  }

  public async findOne(
    fields:
      | EntityCondition<TransacaoClienteItem>
      | EntityCondition<TransacaoClienteItem>[],
  ): Promise<NullableType<TransacaoClienteItem>> {
    return await this.TransacaoClienteItemRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields:
      | EntityCondition<TransacaoClienteItem>
      | EntityCondition<TransacaoClienteItem>[],
  ): Promise<TransacaoClienteItem[]> {
    return await this.TransacaoClienteItemRepository.find({
      where: fields,
    });
  }
}
