import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';
import { Pagador } from '../entity/pagador.entity';
import { PagadorDTO } from '../dto/pagador.dto';

@Injectable()
export class PagadorRepository {
  private logger: Logger = new Logger('PagadorRepository', { timestamp: true });

  constructor(
    @InjectRepository(Pagador)
    private PagadorRepository: Repository<Pagador>,
  ) {}

  
  public async create(pagadorDTO: PagadorDTO): Promise<Pagador> {
    return  await this.PagadorRepository.save(pagadorDTO);
   }


  public async findOne(
    fields: EntityCondition<Pagador> | EntityCondition<Pagador>[],
  ): Promise<Nullable<Pagador>> {
    return await this.PagadorRepository.findOne({
      where: fields,
    });
  }

  public async findAll(): Promise<Pagador[]> {
    return await this.PagadorRepository.find();
  }
}