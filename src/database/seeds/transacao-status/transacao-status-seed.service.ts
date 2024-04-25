import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransacaoStatus } from 'src/cnab/entity/pagamento/transacao-status.entity';
import { TransacaoStatusEnum } from 'src/cnab/enums/pagamento/transacao-status.enum';
import { Enum } from 'src/utils/enum';
import { Repository } from 'typeorm';

@Injectable()
export class TransacaoStatusSeedService {
  constructor(
    @InjectRepository(TransacaoStatus)
    private transacaoRoleRepository: Repository<TransacaoStatus>,
  ) { }

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    const enumItems = Enum.getItems(TransacaoStatusEnum);
    const newItems = enumItems.map(item =>
      this.transacaoRoleRepository.create({
        id: item.value,
        name: item.key,
      }));
    await this.transacaoRoleRepository.upsert(newItems, { conflictPaths: { id: true } });
  }
}
