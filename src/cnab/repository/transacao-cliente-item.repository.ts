import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository, UpdateResult } from 'typeorm';
import { TransacaoClienteItem } from '../entity/transacao-cliente-item.entity';
import { SaveTransacaoClienteItemDTO } from '../dto/save-transacao-cliente-item.dto';

@Injectable()
export class TransacaoClienteItemRepository {
  private logger: Logger = new Logger('TransacaoClienteItemRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(TransacaoClienteItem)
    private transacaoClienteItemRepository: Repository<TransacaoClienteItem>,
  ) {}

  public async save(dto: SaveTransacaoClienteItemDTO): Promise<void> {
    if (dto.id === undefined) {
      await this.create(dto);
    } else {
      await this.update(dto.id, dto);
    }
  }

  public async create(
    createProfileDto: SaveTransacaoClienteItemDTO,
  ): Promise<TransacaoClienteItem> {
    const createdItem = await this.transacaoClienteItemRepository.save(
      this.transacaoClienteItemRepository.create(createProfileDto),
    );
    this.logger.log(`TransacaoClienteItem criado: ${createdItem.getLogInfo()}`);
    return createdItem;
  }

  public async update(
    id: number,
    updateDto: SaveTransacaoClienteItemDTO,
  ): Promise<UpdateResult> {
    const updatePayload = await this.transacaoClienteItemRepository.update(
      { id_cliente_favorecido: id },
      updateDto,
    );
    const updatedItem = new TransacaoClienteItem({ id: id, ...updateDto });
    this.logger.log(
      `TransacaoClienteItem atualizado: ${updatedItem.getLogInfo()}`,
    );
    return updatePayload;
  }

  public async findOne(
    fields:
      | EntityCondition<TransacaoClienteItem>
      | EntityCondition<TransacaoClienteItem>[],
  ): Promise<Nullable<TransacaoClienteItem>> {
    return await this.transacaoClienteItemRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields:
      | EntityCondition<TransacaoClienteItem>
      | EntityCondition<TransacaoClienteItem>[],
  ): Promise<TransacaoClienteItem[]> {
    return await this.transacaoClienteItemRepository.find({
      where: fields,
    });
  }
}
