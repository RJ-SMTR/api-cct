import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository, UpdateResult } from 'typeorm';
import { Pagador } from '../entity/pagador.entity';
import { SavePagadorDTO } from '../dto/save-pagador.dto';

@Injectable()
export class PagadorRepository {
  private logger: Logger = new Logger('PagadorRepository', { timestamp: true });

  constructor(
    @InjectRepository(Pagador)
    private PagadorRepository: Repository<Pagador>,
  ) {}

  public async save(dto: SavePagadorDTO): Promise<void> {
    if (dto.id_pagador === undefined) {
      await this.create(dto);
    } else {
      await this.update(dto.id_pagador, dto);
    }
  }

  public async create(createProfileDto: SavePagadorDTO): Promise<Pagador> {
    const createdItem = await this.PagadorRepository.save(
      this.PagadorRepository.create(createProfileDto),
    );
    this.logger.log(`Pagador criado: ${createdItem[0].getLogInfo()}`);
    return createdItem;
  }

  public async update(
    id: number,
    updateDto: SavePagadorDTO,
  ): Promise<UpdateResult> {
    const updatePayload = await this.PagadorRepository.update(
      { id_pagador: id },
      updateDto,
    );
    const updatedItem = new Pagador({ id_pagador: id, ...updateDto });
    this.logger.log(`Pagador atualizado: ${updatedItem.getLogInfo()}`);
    return updatePayload;
  }

  public async findOne(
    fields: EntityCondition<Pagador> | EntityCondition<Pagador>[],
  ): Promise<Nullable<Pagador>> {
    return await this.PagadorRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields: EntityCondition<Pagador> | EntityCondition<Pagador>[],
  ): Promise<Pagador[]> {
    return await this.PagadorRepository.find({
      where: fields,
    });
  }
}
