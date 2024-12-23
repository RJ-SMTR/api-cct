import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, Repository } from 'typeorm';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';

@Injectable()
export class OrdemPagamentoAgrupadoRepository {
  private logger = new CustomLogger(OrdemPagamentoAgrupadoRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamentoAgrupado)
    private ordemPagamentoAgrupadoRepository: Repository<OrdemPagamentoAgrupado>,
  ) {}

  public async save(dto: DeepPartial<OrdemPagamentoAgrupado>): Promise<OrdemPagamentoAgrupado> { 
    return this.ordemPagamentoAgrupadoRepository.save(dto);
  }

  public async saveAll(dtos: DeepPartial<OrdemPagamentoAgrupado>[]): Promise<OrdemPagamentoAgrupado[]> {
    return this.ordemPagamentoAgrupadoRepository.save(dtos);
  }

  public async findOne(fields: EntityCondition<OrdemPagamentoAgrupado>): Promise<Nullable<OrdemPagamentoAgrupado>> {
    return await this.ordemPagamentoAgrupadoRepository.findOne({
      where: fields,
    });
  }

  public async findAll(): Promise<OrdemPagamentoAgrupado[]> {
    return await this.ordemPagamentoAgrupadoRepository.find({});
  }
}