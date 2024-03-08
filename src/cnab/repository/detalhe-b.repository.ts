import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';
import { DetalheBDTO } from '../dto/detalhe-b.dto';
import { DetalheB } from '../entity/detalhe-b.entiy';

@Injectable()
export class DetalheBRepository {
  private logger: Logger = new Logger('DetalheBRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(DetalheB)
    private DetalheBRepository: Repository<DetalheB>,
  ) {}

  public async save(dto: DetalheBDTO): Promise<DetalheB> {
    return await this.DetalheBRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<DetalheB> | EntityCondition<DetalheB>[],
  ): Promise<Nullable<DetalheB>> {
    return await this.DetalheBRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields: EntityCondition<DetalheB> | EntityCondition<DetalheB>[],
  ): Promise<DetalheB[]> {
    return await this.DetalheBRepository.find({
      where: fields,
    });
  }
}
