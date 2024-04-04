import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';
import { HeaderLoteDTO } from '../../dto/pagamento/header-lote.dto';
import { HeaderLote } from '../../entity/pagamento/header-lote.entity';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { asNumber } from 'src/utils/pipe-utils';

@Injectable()
export class HeaderLoteRepository {
  private logger: Logger = new Logger('HeaderLoteRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(HeaderLote)
    private headerLoteRepository: Repository<HeaderLote>,
  ) { }

  public async saveIfNotExists(dto: HeaderLoteDTO, updateIfExists?: boolean
  ): Promise<SaveIfNotExists<HeaderLote>> {
    const existing = await this.findOne({
      headerArquivo: { id: asNumber(dto.headerArquivo?.id) },
      loteServico: asNumber(dto.loteServico),
    });
    const item = !existing || (existing && updateIfExists)
      ? await this.headerLoteRepository.save(dto)
      : existing;
    return {
      isNewItem: !Boolean(existing),
      item: item,
    }
  }

  public async save(dto: HeaderLoteDTO): Promise<HeaderLote> {
    return await this.headerLoteRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<HeaderLote>,
  ): Promise<Nullable<HeaderLote>> {
    return await this.headerLoteRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields: EntityCondition<HeaderLote>,
  ): Promise<HeaderLote[]> {
    return await this.headerLoteRepository.find({
      where: fields,
    });
  }
}
