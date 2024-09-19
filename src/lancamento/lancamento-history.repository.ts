import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compactQuery } from 'src/utils/console-utils';
import { SqlDateOperator } from 'src/utils/sql/interfaces/sql-date-operator.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { dateMonthToHumanMonth } from 'src/utils/types/human-month.type';
import { Between, DeepPartial, DeleteResult, FindManyOptions, FindOneOptions, FindOptionsWhere, QueryRunner, Repository, SaveOptions, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { LancamentoHistory } from './entities/lancamento-history.entity';
import { Lancamento } from './entities/lancamento.entity';

export interface LancamentoFindWhere {
  detalheA?: { id: number[] };
  data_lancamento?: SqlDateOperator;
}

@Injectable()
export class LancamentoHistoryRepository {
  constructor(
    @InjectRepository(LancamentoHistory)
    private readonly lancamentoHistoryRepository: Repository<LancamentoHistory>,
  ) {}

  create(entityLike: DeepPartial<LancamentoHistory>): LancamentoHistory {
    return this.lancamentoHistoryRepository.create(entityLike);
  }

  async createBackup(lancamento: Lancamento): Promise<LancamentoHistory> {
    const lancamentoHistory = LancamentoHistory.fromLancamento(lancamento, false);
    const saved = await this.lancamentoHistoryRepository.save(lancamentoHistory);
    return saved;
  }

  save(entity: DeepPartial<LancamentoHistory>, options?: SaveOptions): Promise<LancamentoHistory> {
    return this.lancamentoHistoryRepository.save(entity, options);
  }

  update(criteria: FindOptionsWhere<LancamentoHistory>, partialEntity: QueryDeepPartialEntity<LancamentoHistory>, queryRunner?: QueryRunner): Promise<UpdateResult> {
    return (queryRunner?.manager?.getRepository(Lancamento) || this.lancamentoHistoryRepository).update(criteria, partialEntity);
  }

  async findOne(options: FindOneOptions<LancamentoHistory>): Promise<LancamentoHistory | null> {
    let qb = this.lancamentoHistoryRepository
      .createQueryBuilder('lancamento') //
      .leftJoinAndSelect('lancamento.autorizacoes', 'autorizacoes')
      .leftJoinAndSelect('lancamento.autor', 'autor')
      .leftJoinAndSelect('lancamento.clienteFavorecido', 'clienteFavorecido')
      .leftJoinAndSelect('lancamento.itemTransacao', 'itemTransacao')
      .leftJoinAndSelect('itemTransacao.itemTransacaoAgrupado', 'itemTransacaoAgrupado')
      .leftJoinAndMapOne('lancamento.detalheA', 'detalhe_a', 'detalheA', 'detalheA.itemTransacaoAgrupadoId = itemTransacaoAgrupado.id')
      .leftJoinAndMapMany('lancamento.ocorrencias', 'ocorrencia', 'ocorrencia', 'ocorrencia.detalheAId = detalheA.id');

    if (options?.where) {
      qb = qb.where(options.where);
    }

    return await qb.getOne();
  }

  async getOne(options: FindOneOptions<LancamentoHistory>): Promise<LancamentoHistory> {
    const found = await this.findOne(options);
    if (!found) {
      throw new HttpException('Lancamento não encontrado', HttpStatus.NOT_FOUND);
    }
    return found;
  }

  async findMany(options?: FindManyOptions<LancamentoHistory> | undefined, andWhere?: LancamentoFindWhere): Promise<LancamentoHistory[]> {
    let whereCount = 0;
    let qb = this.lancamentoHistoryRepository
      .createQueryBuilder('lancamentoHistory') //
      .leftJoinAndSelect('lancamentoHistory.autorizacoes', 'autorizacoes')
      .leftJoinAndSelect('lancamentoHistory.autor', 'autor')
      .leftJoinAndSelect('lancamentoHistory.clienteFavorecido', 'clienteFavorecido')
      .leftJoinAndSelect('lancamentoHistory.itemTransacao', 'itemTransacao')
      .leftJoinAndSelect('itemTransacao.itemTransacaoAgrupado', 'itemTransacaoAgrupado')
      .leftJoinAndMapOne('lancamentoHistory.detalheA', 'detalhe_a', 'detalheA', 'detalheA.itemTransacaoAgrupadoId = itemTransacaoAgrupado.id')
      .leftJoinAndMapMany('lancamentoHistory.ocorrencias', 'ocorrencia', 'ocorrencia', 'ocorrencia.detalheAId = detalheA.id');

    if (options?.where) {
      qb = qb[!whereCount ? 'where' : 'andWhere'](options?.where);
      whereCount += 1;
    }
    if (andWhere) {
      if (andWhere?.detalheA) {
        qb = qb[!whereCount ? 'where' : 'andWhere']('detalheA.id IN(:daId)', { daId: andWhere.detalheA.id.join(',') });
        whereCount += 1;
      }
      if (andWhere?.data_lancamento) {
        if (andWhere.data_lancamento.is) {
          qb = qb[!whereCount ? 'where' : 'andWhere']({ data_lancamento: andWhere.data_lancamento.is } as EntityCondition<Lancamento>);
          whereCount += 1;
        }
        if (andWhere.data_lancamento.between) {
          qb = qb[!whereCount ? 'where' : 'andWhere']({ data_lancamento: Between(...andWhere.data_lancamento.between) } as EntityCondition<Lancamento>);
          whereCount += 1;
        }
        if (andWhere.data_lancamento.year) {
          qb = qb[!whereCount ? 'where' : 'andWhere']('EXTRACT(YEAR FROM lancamento.data_lancamento) = :year', { year: andWhere.data_lancamento.year });
          whereCount += 1;
        }
        if (andWhere.data_lancamento.month) {
          const month = dateMonthToHumanMonth(andWhere.data_lancamento.month);
          qb = qb[!whereCount ? 'where' : 'andWhere']('EXTRACT(MONTH FROM lancamento.data_lancamento) = :month', { month });
          whereCount += 1;
        }
        if (andWhere.data_lancamento.day) {
          const [operation, day] = andWhere.data_lancamento.day;
          qb = qb[!whereCount ? 'where' : 'andWhere'](`EXTRACT(DAY FROM lancamento.data_lancamento) ${operation} :day`, { day });
          whereCount += 1;
        }
      }
    }
    qb = qb.orderBy('lancamento.id', 'DESC');
    const ret = await qb.getMany();
    return ret;
  }

  getAll(): Promise<LancamentoHistory[]> {
    return this.findMany();
  }

  async softDelete(id: number): Promise<DeleteResult> {
    return await this.lancamentoHistoryRepository.softDelete(id);
  }
}
