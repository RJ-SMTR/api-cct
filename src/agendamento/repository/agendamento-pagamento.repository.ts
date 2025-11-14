import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, Repository } from 'typeorm';
import { AgendamentoPagamento } from '../domain/entity/agendamento-pagamento.entity';
import { AgendamentoPagamentoDTO } from '../domain/dto/agendamento-pagamento.dto';


@Injectable()
export class AgendamentoPagamentoRepository {
  private logger: Logger = new Logger('AgendamentoPagamentoRepository', { timestamp: true });

  constructor(
    @InjectRepository(AgendamentoPagamento)
    private agendamentoPagamentoRepository: Repository<AgendamentoPagamento>,
  ) { }

  public async save(agendamentoPagamentoDTO: AgendamentoPagamentoDTO): Promise<AgendamentoPagamento> {
    return await this.agendamentoPagamentoRepository.save(agendamentoPagamentoDTO);
  }


  public async findOne(
    fields: EntityCondition<AgendamentoPagamento>,
  ): Promise<Nullable<AgendamentoPagamento>> {
    return await this.agendamentoPagamentoRepository.findOne({
      where: fields,
    });
  }

  public async findAllBooking(): Promise<AgendamentoPagamento[]> {
    return await this.agendamentoPagamentoRepository.find(
    {  order: {
      id: 'desc',
    },
  });
  }

  public async delete(id: number) {
    await this.agendamentoPagamentoRepository.delete(id);
  }

}