import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';
import { PagamentoIndevido } from '../entity/pagamento-indevido.entity';
import { PagamentoIndevidoDTO } from '../dto/pagamento-indevido.dto';

@Injectable()
export class PagamentoIndevidoRepository {
  private logger: Logger = new Logger('PagamentoIndevidoRepository', { timestamp: true });

  constructor(
    @InjectRepository(PagamentoIndevido)
    private pagamentoIndevidoRepository: Repository<PagamentoIndevido>,
  ) { }


  public async save(pagamentoIndevidoDTO: PagamentoIndevidoDTO): Promise<PagamentoIndevido> {
    return await this.pagamentoIndevidoRepository.save(pagamentoIndevidoDTO);
  }


  public async findOne(
    fields: EntityCondition<PagamentoIndevido>,
  ): Promise<Nullable<PagamentoIndevido>> {
    return await this.pagamentoIndevidoRepository.findOne({
      where: fields,
    });
  }

  public async findAll(): Promise<PagamentoIndevido[]> {
    return await this.pagamentoIndevidoRepository.find();
  }

}