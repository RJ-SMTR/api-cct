import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import { Repository, UpdateResult } from 'typeorm';
import { Pagador } from '../entity/pagador.entity';
import { CreatePagadorDto } from '../interfaces/pagador/create-pagador.dto';
import { UpdatePagadorDto } from '../interfaces/pagador/update-pagador.dto';

@Injectable()
export class PagadorRepository {
  private logger: Logger = new Logger('PagadorRepository', { timestamp: true });

  constructor(
    @InjectRepository(Pagador)
    private PagadorRepository: Repository<Pagador>,
  ) {}

  public async create(createProfileDto: CreatePagadorDto): Promise<Pagador> {
    const createdItem = await this.PagadorRepository.save(
      this.PagadorRepository.create(createProfileDto),
    );
    this.logger.log(`Pagador criado: ${createdItem[0].getLogInfo()}`);
    return createdItem[0];
  }

  public async update(
    id: number,
    updateDto: UpdatePagadorDto,
  ): Promise<UpdateResult> {
    const updatePayload = await this.PagadorRepository.update(
      { id_pagador: id },
      updateDto,
    );
    return updatePayload;
  }

  public async findOne(
    fields: EntityCondition<Pagador> | EntityCondition<Pagador>[],
  ): Promise<NullableType<Pagador>> {
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
