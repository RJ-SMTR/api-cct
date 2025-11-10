import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';
import { AprovacaoPagamentoDTO } from '../domain/dto/aprovacao-pagamento.dto';
import { AprovacaoPagamento } from '../domain/entity/aprovacao-pagamento.entity';


@Injectable()
export class AprovacaoPagamentoRepository {
  private logger: Logger = new Logger('AprovacaoPagamentoRepository', { timestamp: true });

  constructor(
    @InjectRepository(AprovacaoPagamento)
    private aprovacaoPagamentoRepository: Repository<AprovacaoPagamento>,
  ) { }  

  public async findAll(): Promise<AprovacaoPagamento[]> {
    return await this.aprovacaoPagamentoRepository.find();
  }

  public async findOne(
    fields: EntityCondition<AprovacaoPagamento>,
  ): Promise<Nullable<AprovacaoPagamento>> {
    return await this.aprovacaoPagamentoRepository.findOne({
      where: fields,
    });
  }

  public async save(aprovacaoPagamentoDTO: AprovacaoPagamentoDTO): Promise<AprovacaoPagamento> {
    return await this.aprovacaoPagamentoRepository.save(aprovacaoPagamentoDTO);
  }

  public async delete(id:number) {
     await this.aprovacaoPagamentoRepository.delete(id);
  }

}