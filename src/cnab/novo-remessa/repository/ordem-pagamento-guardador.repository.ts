import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Between, DataSource, DeepPartial, FindOptionsWhere, ILike, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { PagadorDTO } from 'src/cnab/dto/pagamento/pagador.dto';
import { OrdemPagamentoGuardador } from '../entity/ordem-pagamento-guardador.entity';

export interface OrdemPagamentoGuardadorListFilters {
  dataOrdemInicio?: Date;
  dataOrdemFim?: Date;
  cpfCnpj?: string;
  nome?: string;
}


@Injectable()
export class OrdemPagamentoGuardadorRepository {

  private logger = new CustomLogger(OrdemPagamentoGuardadorRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamentoGuardador)
    private ordemPagamentoGuardadorRepository: Repository<OrdemPagamentoGuardador>,
    private readonly dataSource: DataSource
  ) { }


  public async save(dto: DeepPartial<OrdemPagamentoGuardador>): Promise<OrdemPagamentoGuardador> {
   // const existing = await this.ordemPagamentoGuardadorRepository.findOneBy({ id: dto.id });
   // if (existing) {
   //   return existing;
   // }

   // const createdOrdem = this.ordemPagamentoGuardadorRepository.create(dto);
    return this.ordemPagamentoGuardadorRepository.save(dto);
  }

  public async saveMany(dtos: DeepPartial<OrdemPagamentoGuardador>[]): Promise<OrdemPagamentoGuardador[]> {
    const entities = this.ordemPagamentoGuardadorRepository.create(dtos);
    return this.ordemPagamentoGuardadorRepository.save(entities);
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

  private buildListFiltersWhere(filters?: OrdemPagamentoGuardadorListFilters): FindOptionsWhere<OrdemPagamentoGuardador> {
    const where: FindOptionsWhere<OrdemPagamentoGuardador> = {};

    if (filters?.dataOrdemInicio && filters?.dataOrdemFim) {
      where.dataOrdem = Between(filters.dataOrdemInicio, filters.dataOrdemFim);
    } else if (filters?.dataOrdemInicio) {
      where.dataOrdem = MoreThanOrEqual(filters.dataOrdemInicio);
    } else if (filters?.dataOrdemFim) {
      where.dataOrdem = LessThanOrEqual(filters.dataOrdemFim);
    }

    if (filters?.cpfCnpj || filters?.nome) {
      where.user = {
        ...(filters.cpfCnpj ? { cpfCnpj: ILike(`%${filters.cpfCnpj}%`) } : {}),
        ...(filters.nome ? { fullName: ILike(`%${filters.nome}%`) } : {}),
      };
    }

    return where;
  }

  public async findAllPaginated(
    page: number,
    limit: number,
    filters?: OrdemPagamentoGuardadorListFilters,
  ): Promise<[OrdemPagamentoGuardador[], number]> {
    const where = this.buildListFiltersWhere(filters);

    return this.ordemPagamentoGuardadorRepository.findAndCount({
      where,
      order: { dataOrdem: 'DESC', id: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
  }

  public async sumValorFiltered(filters?: OrdemPagamentoGuardadorListFilters): Promise<number> {
    const where = this.buildListFiltersWhere(filters);
    const total = await this.ordemPagamentoGuardadorRepository.sum('valorRepasseGuardador', where);
    return Number(total ?? 0);
  }

  public async agruparOrdensDePagamentoGuardador(dataInicial: Date, dataFinal: Date, dataPgto: Date, pagador: PagadorDTO): Promise<void> {
    const dtInicialStr = dataInicial.toISOString().split('T')[0];
    const dtFinalStr = dataFinal.toISOString().split('T')[0];
    const dtPgtoStr = dataPgto.toISOString().split('T')[0];
    await this.ordemPagamentoGuardadorRepository.query(`CALL P_AGRUPAR_ORDENS_GUARDADOR($1, $2, $3, $4)`, [`${dtInicialStr} 00:00:00`, `${dtFinalStr} 23:59:59`, dtPgtoStr, pagador.id]);
  }


  async findNumeroOrdensPorIntervaloDataCaptura(startDate: Date, endDate: Date) {
    // Query max dataCaptura
    const query = `SELECT COUNT(*) as qtde FROM ordem_pagamento_guardador op 
                    where date_trunc('day', "dataOrdem") between $1 and $2`;
    const result = await this.ordemPagamentoGuardadorRepository.query(query, [startDate, endDate]);
    if (result.length > 0) {
      return parseFloat(result[0].qtde);
    }
    return Promise.resolve(undefined);
  }

  public async findOrdensAgrupadas(dataInicio: Date, dataFim: Date) {

    const dtInicialStr = dataInicio.toISOString().split('T')[0];
    const dtFinalStr = dataFim.toISOString().split('T')[0];

    const query = `SELECT distinct op."ordemPagamentoAgrupadoId" FROM ordem_pagamento_guardador op 
                    where date_trunc('day', op."dataOrdem") between '${dtInicialStr}' and '${dtFinalStr}'                      
                    and op."ordemPagamentoAgrupadoId" is not null `;

    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    let result: any = await queryRunner.query(query);

    queryRunner.release();

    return result;
  }

    public async findOrdensPorPeriodo(dataInicio: Date, dataFim: Date) {

    const dtInicialStr = dataInicio.toISOString().split('T')[0];
    const dtFinalStr = dataFim.toISOString().split('T')[0];

    const query = `SELECT distinct op.* FROM ordem_pagamento_guardador op 
                    where date_trunc('day', op."dataOrdem") between '${dtInicialStr}' and '${dtFinalStr}' `;

    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    let result: any = await queryRunner.query(query);

    queryRunner.release();

    return result;
  }
  

  async removerAgrupamento(ids: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      queryRunner.connect();
      const query = ` update ordem_pagamento_guardador set "ordemPagamentoAgrupadoId"=null 
                    where "ordemPagamentoAgrupadoId" in('${ids}') `;

      await queryRunner.query(query);
    } finally {
      queryRunner.release();
    }
  }
}