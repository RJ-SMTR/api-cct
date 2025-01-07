import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, Repository } from 'typeorm';
import { OrdemPagamentoAgrupadoHistorico } from '../entity/ordem-pagamento-agrupado-historico.entity';

@Injectable()
export class OrdemPagamentoAgrupadoHistoricoRepository {
  private logger = new CustomLogger(OrdemPagamentoAgrupadoHistoricoRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamentoAgrupadoHistorico)
    private ordemPagamentoAgrupadoHistoricoRepository: Repository<OrdemPagamentoAgrupadoHistorico>,
  ) {}

  public async save(dto: DeepPartial<OrdemPagamentoAgrupadoHistorico>): Promise<OrdemPagamentoAgrupadoHistorico> { 
    return this.ordemPagamentoAgrupadoHistoricoRepository.save(dto);
  }

  public async findOne(fields: EntityCondition<OrdemPagamentoAgrupadoHistorico>): Promise<Nullable<OrdemPagamentoAgrupadoHistorico>> {
    return await this.ordemPagamentoAgrupadoHistoricoRepository.findOne({
      where: fields,      
      order: {
        id: 'DESC',
      },
    });
  }

  public async findAll(): Promise<OrdemPagamentoAgrupadoHistorico[]> {
    return await this.ordemPagamentoAgrupadoHistoricoRepository.find({});
  }
}