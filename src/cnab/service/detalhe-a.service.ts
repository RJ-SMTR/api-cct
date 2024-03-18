import { Injectable, Logger } from '@nestjs/common';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DetalheADTO } from '../dto/detalhe-a.dto';
import { DetalheA } from '../entity/detalhe-a.entity';
import { DetalheARepository } from '../repository/detalhe-a.repository';

@Injectable()
export class DetalheAService {
  private logger: Logger = new Logger('DetalheAService', { timestamp: true });

  constructor(private detalheARepository: DetalheARepository) { }

  public async save(dto: DetalheADTO): Promise<DetalheA> {
    await validateDTO(DetalheADTO, dto);
    return await this.detalheARepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.findOne(fields);
  }

  public async findMany(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<DetalheA[]> {
    return await this.detalheARepository.findMany(fields);
  }

  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.detalheARepository.getNextNumeroDocumento(date);
  }
}
