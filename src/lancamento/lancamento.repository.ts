import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compactQuery } from 'src/utils/console-utils';
import { SqlDateOperator } from 'src/utils/sql/interfaces/sql-date-operator.interface';
import { Between, DeepPartial, DeleteResult, FindManyOptions, FindOneOptions, FindOptionsWhere, QueryRunner, Repository, SaveOptions, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Lancamento } from './entities/lancamento.entity';
import { isDate } from 'date-fns';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { dateMonthToHumanMonth } from 'src/utils/types/human-month.type';

export interface LancamentoUpdateWhere {
  transacaoAgrupadoId: number;
}

export interface LancamentoFindWhere {
  detalheA?: { id: number[] };
  data_lancamento?: SqlDateOperator;
}

@Injectable()
export class LancamentoRepository {
  constructor(
    @InjectRepository(Lancamento)
    private readonly lancamentoRepository: Repository<Lancamento>,
  ) {}

  create(entityLike: DeepPartial<Lancamento>): Lancamento {
    return this.lancamentoRepository.create(entityLike);
  }

  save(entity: DeepPartial<Lancamento>, options?: SaveOptions): Promise<Lancamento> {
    return this.lancamentoRepository.save(entity, options);
  }

  async updateRaw(set: DeepPartial<Lancamento>, where: LancamentoUpdateWhere): Promise<UpdateResult> {
    return await this.lancamentoRepository
      .createQueryBuilder('lancamento')
      .update()
      .set(set)
      .where(
        compactQuery(`
      id IN (
          SELECT l1.id FROM lancamento l1
          LEFT JOIN item_transacao it ON it.id = l1."itemTransacaoId"
          LEFT JOIN item_transacao_agrupado ita ON ita.id = it."itemTransacaoAgrupadoId"
          LEFT JOIN transacao_agrupado ta ON ta.id = ita."transacaoAgrupadoId"
          WHERE ta.id = :transacaoAgrupadoId
      )
    `),
        where,
      )
      .execute();
  }

  update(criteria: FindOptionsWhere<Lancamento>, partialEntity: QueryDeepPartialEntity<Lancamento>, queryRunner?: QueryRunner): Promise<UpdateResult> {
    return (queryRunner?.manager?.getRepository(Lancamento) || this.lancamentoRepository).update(criteria, partialEntity);
  }

  async findOne(options: FindOneOptions<Lancamento>): Promise<Lancamento | null> {
    let qb = this.lancamentoRepository
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

  async getOne(options: FindOneOptions<Lancamento>): Promise<Lancamento> {
    const found = await this.findOne(options);
    if (!found) {
      throw new HttpException('Lancamento não encontrado', HttpStatus.NOT_FOUND);
    }
    return found;
  }

  async findMany(options?: FindManyOptions<Lancamento> | undefined, andWhere?: LancamentoFindWhere): Promise<Lancamento[]> {
    let whereCount = 0;
    let qb = this.lancamentoRepository
      .createQueryBuilder('lancamento') //
      .leftJoinAndSelect('lancamento.autorizacoes', 'autorizacoes')
      .leftJoinAndSelect('lancamento.autor', 'autor')
      .leftJoinAndSelect('lancamento.clienteFavorecido', 'clienteFavorecido')
      .leftJoinAndSelect('lancamento.itemTransacao', 'itemTransacao')
      .leftJoinAndSelect('itemTransacao.itemTransacaoAgrupado', 'itemTransacaoAgrupado')
      .leftJoinAndMapOne('lancamento.detalheA', 'detalhe_a', 'detalheA', 'detalheA.itemTransacaoAgrupadoId = itemTransacaoAgrupado.id')
      .leftJoinAndMapMany('lancamento.ocorrencias', 'ocorrencia', 'ocorrencia', 'ocorrencia.detalheAId = detalheA.id');

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

  getAll(): Promise<Lancamento[]> {
    return this.findMany();
  }

  softDelete(id: number): Promise<DeleteResult> {
    return this.lancamentoRepository.softDelete(id);
  }
}
