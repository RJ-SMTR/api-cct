import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { PagadorDTO } from 'src/cnab/dto/pagamento/pagador.dto';
import { OrdemPagamentoGuardador } from '../entity/ordem-pagamento-guardador.entity';


@Injectable()
export class OrdemPagamentoGuardadorRepository {

  private logger = new CustomLogger(OrdemPagamentoGuardadorRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamentoGuardador)
    private ordemPagamentoGuardadorRepository: Repository<OrdemPagamentoGuardador>,
    private readonly dataSource: DataSource
  ) { }


  public async save(dto: DeepPartial<OrdemPagamentoGuardador>): Promise<OrdemPagamentoGuardador> {
    const existing = await this.ordemPagamentoGuardadorRepository.findOneBy({ id: dto.id });
    if (existing) {
      return existing;
    }
    const createdOrdem = this.ordemPagamentoGuardadorRepository.create(dto);
    return this.ordemPagamentoGuardadorRepository.save(createdOrdem);
  }

  public async findOne(fields: EntityCondition<OrdemPagamentoGuardador>): Promise<Nullable<OrdemPagamentoGuardador>> {
    return await this.ordemPagamentoGuardadorRepository.findOne({
      where: fields,
    });
  }

  public async findAll(fields: EntityCondition<OrdemPagamentoGuardador>): Promise<OrdemPagamentoGuardador[]> {
    return await this.ordemPagamentoGuardadorRepository.find({
      where: fields,
    });
  }

  public async agruparOrdensDePagamentoGuardador(dataInicial: Date, dataFinal: Date, dataPgto: Date, pagador: PagadorDTO): Promise<void> {
    const dtInicialStr = dataInicial.toISOString().split('T')[0];
    const dtFinalStr = dataFinal.toISOString().split('T')[0];
    const dtPgtoStr = dataPgto.toISOString().split('T')[0];    
    await this.ordemPagamentoGuardadorRepository.query(`CALL P_AGRUPAR_ORDENS_GUARDADOR($1, $2, $3, $4)`, [`${dtInicialStr} 00:00:00`, `${dtFinalStr} 23:59:59`, dtPgtoStr, pagador.id]);
  }

 
}
