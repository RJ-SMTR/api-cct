import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PagamentosPendentes } from 'src/cnab/entity/pagamento/pagamentos-pendentes.entity';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, FindManyOptions, Repository } from 'typeorm';

@Injectable()
export class PagamentosPendentesRepository {
  private logger: Logger = new Logger('PagadorRepository', { timestamp: true });

  constructor(
    @InjectRepository(PagamentosPendentes)
    private pagadorRepository: Repository<PagamentosPendentes>,
  ) { }


public async save(dto: DeepPartial<PagamentosPendentes>): Promise<PagamentosPendentes> {
  return await this.pagadorRepository.save(dto);
}

public async getOne(
  fields: EntityCondition<PagamentosPendentes>,
): Promise<Nullable<PagamentosPendentes>> {
  return await this.pagadorRepository.findOneOrFail({
    where: fields,
  });
}

public async findOne(
  fields: EntityCondition<PagamentosPendentes>,
): Promise<Nullable<PagamentosPendentes>> {
  return await this.pagadorRepository.findOne({
    where: fields,
  });
}

public async findMany(
  options?: FindManyOptions<PagamentosPendentes>,
): Promise<PagamentosPendentes[]> {
  return await this.pagadorRepository.find(options);
}
}
