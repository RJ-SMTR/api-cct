import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ItemTransacaoStatus } from 'src/cnab/entity/intermediate/item-transacao-status.entity';
import { ItemTransacaoStatusEnum } from 'src/cnab/enums/intermediate/item-transacao-status.enum';
import { Enum } from 'src/utils/enum';
import { Repository } from 'typeorm';

@Injectable()
export class ItemTransacaoStatusSeedService {
  constructor(
    @InjectRepository(ItemTransacaoStatus)
    private itemTrStatusRepository: Repository<ItemTransacaoStatus>,
  ) { }

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    const enumItems = Enum.getItems(ItemTransacaoStatusEnum);
    const newItems = enumItems.map(item =>
      this.itemTrStatusRepository.create({
        id: item.value,
        name: item.key,
      }));
    await this.itemTrStatusRepository.upsert(newItems, { conflictPaths: { id: true } });
  }
}
