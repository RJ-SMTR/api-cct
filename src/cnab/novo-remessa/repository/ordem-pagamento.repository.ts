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
        `DATE_TRUNC('day', ordemPagamento.dataOrdem) as dataOrdem`, // Truncating the date to day level
        'ordemPagamento.idOperadora',
        'SUM(ordemPagamento.valor) as valorTotal',
        `JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', ordemPagamento.id,
          'dataOrdem', ordemPagamento.dataOrdem,
          'valor', "ordemPagamento".valor
        )
      ) as ordensPagamento`
      ])
      .where(fields)
      .groupBy('ordemPagamento.userId')
      .addGroupBy(`DATE_TRUNC('day', ordemPagamento.dataOrdem)`) // Ensure to group by truncated date
      .addGroupBy('ordemPagamento.idOperadora') // Order by the less recent within the group
      .getRawMany();

    const result: OrdensPagamentoAgrupadasDto[] = groupedData.map((item) => {
      return {
        userId: item.ordemPagamento_userId,
        dataOrdem: item.ordemPagamento_dataordem,
        idOperadora: item.ordemPagamento_idOperadora,
        valorTotal: item.valortotal,
        ordensPagamento: item.ordenspagamento.map((op: any) => {
          if (op) {
            const ordemPagamento = new OrdemPagamento();
            ordemPagamento.id = op.id;
            ordemPagamento.dataOrdem = op.dataOrdem;
            ordemPagamento.valor = op.valor;
            return ordemPagamento;
          }
        }), // Parse JSON array into OrdemPagamento objects
      };
    });

    return result;
  }

}
