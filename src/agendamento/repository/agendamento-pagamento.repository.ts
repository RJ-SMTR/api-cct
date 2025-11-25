import { Injectable, Logger, HttpException, HttpStatus, } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcryptjs';
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

  public async delete(id: number, LancamentoAuthorizeDto: string, userId: any): Promise<any>  {
    let result 
    const isValidPassword = await bcrypt.compare(LancamentoAuthorizeDto, userId.password)
    if (!isValidPassword) { 
      throw new HttpException('Usuário não encontrado', HttpStatus.UNAUTHORIZED);
    } else {
       result = await this.agendamentoPagamentoRepository.delete(id);
    }

    return result
  }

}