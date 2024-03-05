import { Injectable, Logger } from '@nestjs/common';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DetalheBDTO } from '../dto/detalhe-b.dto';
import { DetalheBRepository } from '../repository/detalhe-b.repository';
import { DetalheB } from '../entity/detalhe-b.entiy';
import { validateDTO } from 'src/utils/validation-utils';

@Injectable()
export class DetalheBService {
  private logger: Logger = new Logger('DetalheBService', { timestamp: true });

  constructor(private detalheBRepository: DetalheBRepository) {}

  public async save(dto: DetalheBDTO): Promise<void> {
    await validateDTO(DetalheBDTO, dto);
    await this.detalheBRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<DetalheB> | EntityCondition<DetalheB>[],
  ): Promise<Nullable<DetalheB>> {
    return await this.detalheBRepository.findOne(fields);
  }

  public async findMany(
    fields: EntityCondition<DetalheB> | EntityCondition<DetalheB>[],
  ): Promise<DetalheB[]> {
    return await this.detalheBRepository.findMany(fields);
  }
}
