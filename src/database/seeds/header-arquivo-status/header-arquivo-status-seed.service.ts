import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HeaderArquivoStatus } from 'src/cnab/entity/pagamento/header-arquivo-status.entity';
import { HeaderArquivoStatusEnum } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { Enum } from 'src/utils/enum';
import { Repository } from 'typeorm';

@Injectable()
export class HeaderArquivoStatusSeedService {
  constructor(
    @InjectRepository(HeaderArquivoStatus)
    private itemTrStatusRepository: Repository<HeaderArquivoStatus>,
  ) { }

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    const enumItems = Enum.getItems(HeaderArquivoStatusEnum);
    const newItems = enumItems.map(item =>
      this.itemTrStatusRepository.create({
        id: item.value,
        name: item.key,
      }));
    await this.itemTrStatusRepository.upsert(newItems, { conflictPaths: { id: true } });
  }
}
