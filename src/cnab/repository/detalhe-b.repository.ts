import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository, UpdateResult } from 'typeorm';
import { DetalheB } from '../entity/detalhe-b.entiy';
import { SaveDetalheBDTO } from '../dto/save-detalhe-b.dto';

@Injectable()
export class DetalheBRepository {
  private logger: Logger = new Logger('DetalheBRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(DetalheB)
    private DetalheBRepository: Repository<DetalheB>,
  ) {}

  async save(dto: SaveDetalheBDTO): Promise<void> {
    if (dto.id_detalhe_a === undefined) {
      await this.create(dto);
    } else {
      await this.update(dto.id_detalhe_a, dto);
    }
  }

  async create(createProfileDto: SaveDetalheBDTO): Promise<DetalheB> {
    const createdUser = await this.DetalheBRepository.save(
      this.DetalheBRepository.create(createProfileDto),
    );
    this.logger.log(`DetalheB criado: ${createdUser.getLogInfo()}`);
    return createdUser;
  }

  async update(id: number, updateDto: SaveDetalheBDTO): Promise<UpdateResult> {
    const updatePayload = await this.DetalheBRepository.update(
      { id_detalhe_b: id },
      updateDto,
    );
    const updatedItem = new DetalheB({ id_detalhe_b: id, ...updateDto });
    this.logger.log(`DetalheB atualizado: ${updatedItem.getLogInfo()}`);
    return updatePayload;
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
