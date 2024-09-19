import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SqlDateOperator } from 'src/utils/sql/interfaces/sql-date-operator.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { dateMonthToHumanMonth } from 'src/utils/types/human-month.type';
import { Between, DeepPartial, DeleteResult, FindManyOptions, FindOneOptions, FindOptionsWhere, QueryRunner, Repository, SaveOptions, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { LancamentoAutorizacaoHistory } from '../entities/lancamento-autorizacao-history.entity';
import { LancamentoAutorizacao } from '../entities/lancamento-autorizacao.entity';
import { LancamentoHistory } from '../entities/lancamento-history.entity';
import { Lancamento } from '../entities/lancamento.entity';

export interface LancamentoFindWhere {
  detalheA?: { id: number[] };
  data_lancamento?: SqlDateOperator;
}

@Injectable()
export class LancamentoAutorizacaoHistoryRepository {
  constructor(
    @InjectRepository(LancamentoAutorizacaoHistory)
    private readonly lancamentoAutorizacaoHistoryRepository: Repository<LancamentoAutorizacaoHistory>,
    @InjectRepository(LancamentoAutorizacao)
    private readonly lancamentoAutorizacaoRepository: Repository<LancamentoAutorizacao>,
  ) {}

  create(entityLike: DeepPartial<LancamentoAutorizacaoHistory>): LancamentoAutorizacaoHistory {
    return this.lancamentoAutorizacaoHistoryRepository.create(entityLike);
  }

  async createBackup(lancamentoHistory: LancamentoHistory, lancamento: Lancamento): Promise<LancamentoAutorizacaoHistory[]> {
    const autorizacoes = await this.lancamentoAutorizacaoRepository.find({ where: { lancamento: { id: lancamento.id } } });
    const savedMany: LancamentoAutorizacaoHistory[] = [];
    for (const autorizacao of autorizacoes) {
      const autorizacaoHistory = LancamentoAutorizacaoHistory.fromLancamentoAutorizacao(autorizacao, lancamentoHistory);
      const saved = await this.lancamentoAutorizacaoHistoryRepository.save(autorizacaoHistory);
      savedMany.push(saved);
    }
    return savedMany;
  }

  save(entity: DeepPartial<LancamentoAutorizacaoHistory>, options?: SaveOptions): Promise<LancamentoAutorizacaoHistory> {
    return this.lancamentoAutorizacaoHistoryRepository.save(entity, options);
  }

  update(criteria: FindOptionsWhere<LancamentoAutorizacaoHistory>, partialEntity: QueryDeepPartialEntity<LancamentoAutorizacaoHistory>, queryRunner?: QueryRunner): Promise<UpdateResult> {
    return (queryRunner?.manager?.getRepository(Lancamento) || this.lancamentoAutorizacaoHistoryRepository).update(criteria, partialEntity);
  }

  async findOne(options: FindOneOptions<LancamentoAutorizacaoHistory>): Promise<LancamentoAutorizacaoHistory | null> {
    let qb = this.lancamentoAutorizacaoHistoryRepository
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

  async getOne(options: FindOneOptions<LancamentoAutorizacaoHistory>): Promise<LancamentoAutorizacaoHistory> {
    const found = await this.findOne(options);
    if (!found) {
      throw new HttpException('Lancamento não encontrado', HttpStatus.NOT_FOUND);
    }
    return found;
  }

  async findMany(options?: FindManyOptions<LancamentoAutorizacaoHistory> | undefined, andWhere?: LancamentoFindWhere): Promise<LancamentoAutorizacaoHistory[]> {
    let whereCount = 0;
    let qb = this.lancamentoAutorizacaoHistoryRepository
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

  getAll(): Promise<LancamentoAutorizacaoHistory[]> {
    return this.findMany();
  }

  async softDelete(id: number): Promise<DeleteResult> {
    return await this.lancamentoAutorizacaoHistoryRepository.softDelete(id);
  }
}
