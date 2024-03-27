import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';
import { DetalheBDTO } from '../../dto/pagamento/detalhe-b.dto';
import { DetalheB } from '../../entity/pagamento/detalhe-b.entity';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { asNumber } from 'src/utils/pipe-utils';

@Injectable()
export class DetalheBRepository {
  private logger: Logger = new Logger('DetalheBRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(DetalheB)
    private detalheBRepository: Repository<DetalheB>,
  ) { }

  public async saveIfNotExists(obj: DetalheBDTO): Promise<SaveIfNotExists<DetalheB>> {
    const existing = await this.detalheBRepository.findOne({
      where: {
        detalheA: { id: asNumber(obj.detalheA?.id) }
      }
    });
    const item = existing || await this.detalheBRepository.save(obj);
    return {
      isNewItem: !Boolean(existing),
      item: item,
    }
  }

  public async save(dto: DetalheBDTO): Promise<DetalheB> {
    return await this.detalheBRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<DetalheB> | EntityCondition<DetalheB>[],
  ): Promise<Nullable<DetalheB>> {
    return await this.detalheBRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields: EntityCondition<DetalheB> | EntityCondition<DetalheB>[],
  ): Promise<DetalheB[]> {
    return await this.detalheBRepository.find({
      where: fields,
    });
  }
}
