import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { AgendamentoPagamento } from './agendamento-pagamento.entity';
import { DeepPartial, EntityManager, Repository, SaveOptions } from 'typeorm';

@Injectable()
export class AgendamentoPagamentoRepository {
  private logger = new CustomLogger(AgendamentoPagamentoRepository.name, {
    timestamp: true,
  });
  constructor(
    @InjectRepository(AgendamentoPagamento)
    private agendamentoPagamentoRepository: Repository<AgendamentoPagamento>,
    private readonly entityManager: EntityManager,
  ) {}

  async save(entities: DeepPartial<AgendamentoPagamento>[], options?: SaveOptions) {
    return await this.agendamentoPagamentoRepository.save(entities, options);
  }
}
