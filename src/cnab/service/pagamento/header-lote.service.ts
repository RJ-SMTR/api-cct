import { Injectable, Logger } from '@nestjs/common';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { HeaderLote } from '../../entity/pagamento/header-lote.entity';
import { HeaderLoteDTO } from '../../dto/pagamento/header-lote.dto';
import { HeaderLoteRepository } from '../../repository/pagamento/header-lote.repository';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';

@Injectable()
export class HeaderLoteService {
  private logger: Logger = new Logger('HeaderLoteService', { timestamp: true });

  constructor(private headerLoteRepository: HeaderLoteRepository) { }

  public async save(dto: HeaderLoteDTO): Promise<HeaderLote> {
    await validateDTO(HeaderLoteDTO, dto);
    return await this.headerLoteRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<HeaderLote> | EntityCondition<HeaderLote>[],
  ): Promise<Nullable<HeaderLote>> {
    return await this.headerLoteRepository.findOne(fields);
  }

  public async findMany(
    fields: EntityCondition<HeaderLote> | EntityCondition<HeaderLote>[],
  ): Promise<HeaderLote[]> {
    return await this.headerLoteRepository.findMany(fields);
  }
}
