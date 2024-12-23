import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, Repository } from 'typeorm';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';
import { OrdensPagamentoAgrupadasDto } from '../dto/ordens-pagamento-agrupadas.dto';

@Injectable()
export class OrdemPagamentoRepository {
  private logger = new CustomLogger(OrdemPagamentoRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamento)
    private ordemPagamentoRepository: Repository<OrdemPagamento>,
  ) {}

  public async save(dto: DeepPartial<OrdemPagamento>): Promise<OrdemPagamento> {
    const existing = await this.ordemPagamentoRepository.findOneBy({ id: dto.id });
    if (existing) {
      return existing
    }
    const createdOrdem = this.ordemPagamentoRepository.create(dto);
    return this.ordemPagamentoRepository.save(createdOrdem);
  }

  public async findOne(fields: EntityCondition<OrdemPagamento>): Promise<Nullable<OrdemPagamento>> {
    return await this.ordemPagamentoRepository.findOne({
      where: fields,
    });
  }

  public async findAll(fields: EntityCondition<OrdemPagamento>): Promise<OrdemPagamento[]> {
    return await this.ordemPagamentoRepository.find({
      where: fields,
    });
  }

  public async findOrdensPagamentoAgrupadas(fields: EntityCondition<OrdemPagamento>): Promise<OrdensPagamentoAgrupadasDto[]> {
    const groupedData = await this.ordemPagamentoRepository.createQueryBuilder('ordemPagamento')
      .select([
        'ordemPagamento.userId',
        'DATE_TRUNC(\'day\', ordemPagamento.dataOrdem) as dataOrdem',
        'ordemPagamento.idOperadora',
        'SUM(ordemPagamento.valor) as valorTotal'
      ])
      .where(fields)
      .groupBy('ordemPagamento.userId')
      .addGroupBy('DATE_TRUNC(\'day\', ordemPagamento.dataOrdem)')
      .addGroupBy('ordemPagamento.idOperadora')
      .orderBy('ordemPagamento.createdAt', 'DESC')
      .getRawMany();

    const result : OrdensPagamentoAgrupadasDto[] = await Promise.all(groupedData.map(async (group) => {
      const ordensPagamento = await this.ordemPagamentoRepository.createQueryBuilder('ordemPagamento')
        .where('ordemPagamento.userId = :userId', { userId: group.userId })
        .andWhere('DATE_TRUNC(\'day\', ordemPagamento.dataOrdem) = DATE_TRUNC(\'day\', :dataOrdem)', { dataOrdem: group.dataOrdem })
        .andWhere('ordemPagamento.idOperadora = :idOperadora', { idOperadora: group.idOperadora })
        .getMany();
      return {
        ...group,
        ordensPagamento
      };
    }));

    return result;
  }
}
