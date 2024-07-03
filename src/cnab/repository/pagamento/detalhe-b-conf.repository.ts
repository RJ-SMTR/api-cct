import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, FindManyOptions, In, InsertResult, Repository } from 'typeorm';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { asNumber } from 'src/utils/pipe-utils';
import { logWarn } from 'src/utils/log-utils';
import { DetalheBConf } from 'src/cnab/entity/conference/detalhe-b-conf.entity';
import { DetalheBDTO } from 'src/cnab/dto/pagamento/detalhe-b.dto';
import { DetalheAConf } from 'src/cnab/entity/conference/detalhe-a-conf.entity';

@Injectable()
export class DetalheBConfRepository {
  private logger: Logger = new Logger('DetalheBConfRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(DetalheBConf)
    private DetalheBConfRepository: Repository<DetalheBConf>,
  ) { }

  /**
   * Any DTO existing in db will be ignored.
   * 
   * @param dtos DTOs that can exist or not in database 
   * @returns Saved objects not in database.
   */
  public async saveManyIfNotExists(dtos: DeepPartial<DetalheBConf>[]): Promise<DetalheBConf[]> {
    // Existing
    const existing = await this.findMany({
      where: dtos.reduce((l, i) => [...l, {
        detalheA: { id: asNumber(i.detalheA?.id) },
        nsr: asNumber(i.nsr),
      }], [])
    });
    const existingMap: Record<string, DeepPartial<DetalheAConf>> =
      existing.reduce((m, i) => ({ ...m, [DetalheAConf.getUniqueId(i)]: i }), {});
    // Check
    if (existing.length === dtos.length) {
      logWarn(this.logger, `${existing.length}/${dtos.length} DetalhesB já existem, nada a fazer...`);
    } else if (existing.length) {
      logWarn(this.logger, `${existing.length}/${dtos.length} DetalhesB já existem, ignorando...`);
      return [];
    }
    // Save new
    const newDTOs =
      dtos.reduce((l, i) => [...l, ...!existingMap[DetalheAConf.getUniqueId(i)] ? [i] : []], []);
    const insert = await this.insert(newDTOs);
    // Return saved
    const insertIds = (insert.identifiers as { id: number }[]).reduce((l, i) => [...l, i.id], []);
    const saved = await this.findMany({ where: { id: In(insertIds) } });
    return saved;
  }

  public insert(dtos: DeepPartial<DetalheBConf>[]): Promise<InsertResult> {
    return this.DetalheBConfRepository.insert(dtos);
  }

  public async saveIfNotExists(obj: DetalheBDTO): Promise<SaveIfNotExists<DetalheBConf>> {
    const existing = await this.DetalheBConfRepository.findOne({
      where: {
        detalheA: { id: asNumber(obj.detalheA?.id) }
      }
    });
    const item = existing || await this.DetalheBConfRepository.save(obj);
    return {
      isNewItem: !Boolean(existing),
      item: item,
    }
  }

  public async save(dto: DetalheBDTO): Promise<DetalheBConf> {
    return await this.DetalheBConfRepository.save(dto);
  }

  public async getOne(
    fields: EntityCondition<DetalheBConf>,
  ): Promise<Nullable<DetalheBConf>> {
    return await this.DetalheBConfRepository.findOneOrFail({
      where: fields,
    });
  }

  public async findOne(
    fields: EntityCondition<DetalheBConf>,
  ): Promise<Nullable<DetalheBConf>> {
    return await this.DetalheBConfRepository.findOne({
      where: fields,
    });
  }

  public async findMany(options?: FindManyOptions<DetalheBConf>): Promise<DetalheBConf[]> {
    return await this.DetalheBConfRepository.find(options);
  }
}
