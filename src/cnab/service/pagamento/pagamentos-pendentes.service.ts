import { Injectable, Logger } from '@nestjs/common';
import { PagamentosPendentesDTO } from 'src/cnab/dto/pagamento/pagamentos-pendentes.dto';
import { PagamentosPendentes } from 'src/cnab/entity/pagamento/pagamentos-pendentes.entity';
import { PagamentosPendentesRepository } from 'src/cnab/repository/pagamento/pagamentos-pendentes.repository';

import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial } from 'typeorm';


@Injectable()
export class PagamentosPendentesService {
  private logger: Logger = new Logger('PagamentosPendentesService', { timestamp: true });

  constructor(private pagamentosPendentesRepository: PagamentosPendentesRepository) { }

  public async save(dto: DeepPartial<PagamentosPendentes>) {    
    await this.pagamentosPendentesRepository.save(dto);
  }

  public async saveDto(dto: PagamentosPendentesDTO): Promise<PagamentosPendentes> {
    return await this.pagamentosPendentesRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<PagamentosPendentes>,
  ): Promise<Nullable<PagamentosPendentes>> {
    return await this.pagamentosPendentesRepository.findOne(fields);
  }

  public async findMany(
    fields: EntityCondition<PagamentosPendentes>,
  ): Promise<PagamentosPendentes[]> {
    return await this.pagamentosPendentesRepository.findMany({ where: fields });
  }

  

  
}