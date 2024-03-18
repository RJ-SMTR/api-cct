import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';
import { HeaderLoteDTO } from '../dto/header-lote.dto';
import { HeaderLote } from '../entity/header-lote.entity';

@Injectable()
export class HeaderLoteRepository {
  private logger: Logger = new Logger('HeaderLoteRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(HeaderLote)
    private HeaderLoteRepository: Repository<HeaderLote>,
  ) { }

  public async save(dto: HeaderLoteDTO): Promise<HeaderLote> {
    return await this.HeaderLoteRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<HeaderLote> | EntityCondition<HeaderLote>[],
  ): Promise<Nullable<HeaderLote>> {
    return await this.HeaderLoteRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields: EntityCondition<HeaderLote> | EntityCondition<HeaderLote>[],
  ): Promise<HeaderLote[]> {
    return await this.HeaderLoteRepository.find({
      where: fields,
    });
  }
}
