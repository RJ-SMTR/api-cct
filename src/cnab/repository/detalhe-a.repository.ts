import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { DetalheADTO } from '../dto/detalhe-a.dto';
import { DetalheA } from '../entity/detalhe-a.entity';

@Injectable()
export class DetalheARepository {
  private logger: Logger = new Logger('DetalheARepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(DetalheA)
    private detalheARepository: Repository<DetalheA>,
  ) { }

  public async save(dto: DetalheADTO): Promise<DetalheA> {
    return await this.detalheARepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<DetalheA[]> {
    return await this.detalheARepository.find({
      where: fields,
    });
  }

  /**
   * Obtém o próximo'Número Documento Atribuído pela Empresa' para o DetalheA.
   * 
   * Baseado no mesmo dia.
   */
  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.detalheARepository.count({
      where: [
        { createdAt: MoreThanOrEqual(startOfDay(date)) },
        { createdAt: LessThanOrEqual(endOfDay(date)) },
      ]
    }) + 1;
  }
}
