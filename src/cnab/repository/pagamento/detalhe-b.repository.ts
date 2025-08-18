import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DataSource, DeepPartial, FindManyOptions, In, InsertResult, Repository } from 'typeorm';
import { DetalheBDTO } from '../../dto/pagamento/detalhe-b.dto';
import { DetalheB } from '../../entity/pagamento/detalhe-b.entity';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { asNumber } from 'src/utils/pipe-utils';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { logWarn } from 'src/utils/log-utils';

@Injectable()
export class DetalheBRepository {
  private logger: Logger = new Logger('DetalheBRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(DetalheB)
    private detalheBRepository: Repository<DetalheB>,
    private dataSource: DataSource
  ) { }

  /**
   * Any DTO existing in db will be ignored.
   * 
   * @param dtos DTOs that can exist or not in database 
   * @returns Saved objects not in database.
   */
  public async saveManyIfNotExists(dtos: DeepPartial<DetalheB>[]): Promise<DetalheB[]> {
    // Existing
    const existing = await this.findMany({
      where: dtos.reduce((l, i) => [...l, {
        detalheA: { id: asNumber(i.detalheA?.id) },
        nsr: asNumber(i.nsr),
      }], [])
    });
    const existingMap: Record<string, DeepPartial<DetalheA>> =
      existing.reduce((m, i) => ({ ...m, [DetalheA.getUniqueId(i)]: i }), {});
    // Check
    if (existing.length === dtos.length) {
      logWarn(this.logger, `${existing.length}/${dtos.length} DetalhesB já existem, nada a fazer...`);
    } else if (existing.length) {
      logWarn(this.logger, `${existing.length}/${dtos.length} DetalhesB já existem, ignorando...`);
      return [];
    }
    // Save new
    const newDTOs =
      dtos.reduce((l, i) => [...l, ...!existingMap[DetalheA.getUniqueId(i)] ? [i] : []], []);
    const insert = await this.insert(newDTOs);
    // Return saved
    const insertIds = (insert.identifiers as { id: number }[]).reduce((l, i) => [...l, i.id], []);
    const saved = await this.findMany({ where: { id: In(insertIds) } });
    return saved;
  }

  public insert(dtos: DeepPartial<DetalheB>[]): Promise<InsertResult> {
    return this.detalheBRepository.insert(dtos);
  }

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

  public async getOne(
    fields: EntityCondition<DetalheB>,
  ): Promise<Nullable<DetalheB>> {
    return await this.detalheBRepository.findOneOrFail({
      where: fields,
    });
  }

  public async findOne(
    fields: EntityCondition<DetalheB>,
  ): Promise<Nullable<DetalheB>> {
    return await this.detalheBRepository.findOne({
      where: fields,
    });
  }

  public async findMany(options?: FindManyOptions<DetalheB>): Promise<DetalheB[]> {
    return await this.detalheBRepository.find(options);
  }

  async getDetalheBDetalheAId(detalheAId: number) {

    const query = (`select ddb.* from detalhe_b ddb where ddb."detalheAId" = ${detalheAId}`)

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      const result: any[] = await queryRunner.manager.query(query);

      const detalheB = result.map((i) => new DetalheB(i));

      return detalheB[0];
    } finally {
      await queryRunner.release()
    }
  }
}
