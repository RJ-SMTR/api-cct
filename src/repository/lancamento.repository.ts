import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compactQuery } from 'src/utils/console-utils';
import { SqlDateOperator } from 'src/utils/sql/interfaces/sql-date-operator.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { dateMonthToHumanMonth } from 'src/utils/types/human-month.type';
import { Between, DeepPartial, DeleteResult, FindManyOptions, FindOneOptions, FindOptionsWhere, ObjectLiteral, QueryRunner, Repository, SaveOptions, SelectQueryBuilder, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Lancamento, TLancamento } from '../domain/entity/lancamento.entity';
import { LancamentoHistory } from '../domain/entity/lancamento-history.entity';
import { LancamentoAutorizacao } from '../domain/entity/lancamento-autorizacao.entity';
import { LancamentoAutorizacaoHistory } from '../domain/entity/lancamento-autorizacao-history.entity';
import { LancamentoStatus } from '../domain/enum/lancamento-status.enum';
import { parseQBDateOperator } from 'src/utils/sql/query-builder.utils';

// export interface LancamentoUpdateWhere {
//   transacaoAgrupado: { id: number };
// }

export interface LancamentoFindWhere {
  detalheA?: { id: number[] };
  transacaoAgrupado?: { id: number };
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

  // async updateRaw(set: DeepPartial<Lancamento>, where: LancamentoUpdateWhere): Promise<UpdateResult> {
  //   return await this.lancamentoRepository
  //     .createQueryBuilder('lancamento')
  //     .update()
  //     .set(set)
  //     .where(
  //       compactQuery(`
  //     id IN (
  //         SELECT l1.id FROM lancamento l1
  //         LEFT JOIN item_transacao it ON it.id = l1."itemTransacaoId"
  //         LEFT JOIN item_transacao_agrupado ita ON ita.id = it."itemTransacaoAgrupadoId"
  //         LEFT JOIN transacao_agrupado ta ON ta.id = ita."transacaoAgrupadoId"
  //         WHERE ta.id = :transacaoAgrupadoId
  //     )
  //   `),
  //       where,
  //     )
  //     .execute();
  // }

  update(criteria: FindOptionsWhere<Lancamento>, partialEntity: QueryDeepPartialEntity<Lancamento>, queryRunner?: QueryRunner): Promise<UpdateResult> {
    return (queryRunner?.manager?.getRepository(Lancamento) || this.lancamentoRepository).update(criteria, partialEntity);
  }

  async findOne(options: FindOneOptions<Lancamento>): Promise<Lancamento | null> {
    let qb = this.lancamentoRepository
      .createQueryBuilder('lancamento') //
      .leftJoinAndSelect('lancamento._autorizacoes', 'lancamentoAutorizacao')
      .leftJoinAndSelect('lancamentoAutorizacao.user', 'lancamentoAutorizacao_user')
      .leftJoinAndSelect('lancamento.autor', 'autor')
      .leftJoinAndSelect('lancamento.clienteFavorecido', 'clienteFavorecido')
      .leftJoinAndSelect('lancamento.itemTransacao', 'itemTransacao')
      .leftJoinAndSelect('itemTransacao.itemTransacaoAgrupado', 'itemTransacaoAgrupado')
      .leftJoinAndMapOne('lancamento.detalheA', 'detalhe_a', 'detalheA', 'detalheA.itemTransacaoAgrupadoId = itemTransacaoAgrupado.id')
      .leftJoinAndMapMany('lancamento.ocorrencias', 'ocorrencia', 'ocorrencia', 'ocorrencia.detalheAId = detalheA.id')
      .leftJoinAndMapMany('lancamento.historico', 'lancamento_history', 'lancamentoHistory', 'lancamentoHistory.lancamentoId = lancamento.id')
      .leftJoinAndSelect('lancamentoHistory.autorizacoes', 'lancamentoAutorizacaoHistory')
      .leftJoinAndSelect('lancamentoAutorizacaoHistory.user', 'lancamentoAutorizacaoHistory_user');

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

  async getValorAutoriado(data_lancamento?: SqlDateOperator): Promise<Record<LancamentoStatus, number>> {
    const l = Lancamento.getSqlFields('lancamento');
    let qb = this.lancamentoRepository
      .createQueryBuilder('lancamento')
      .select(l.status)
      .addSelect(`SUM(${l.valor})::FLOAT`, 'valor' as keyof TLancamento);
    if (data_lancamento) {
      [qb] = parseQBDateOperator(qb, l.data_lancamento, data_lancamento);
    }
    const lancamentos: Lancamento[] = await qb.groupBy(l.status).getRawMany();
    const result = Object.values(LancamentoStatus).reduce((d, s) => ((l = lancamentos.find((l1) => l1.status === s)) => ({ ...d, [s]: l?.valor || 0 }))(), {} as Record<LancamentoStatus, number>);
    return result;
  }

  async findMany(options?: FindManyOptions<Lancamento> | undefined, andWhere?: LancamentoFindWhere, eager: (keyof Lancamento)[] = []): Promise<Lancamento[]> {
    let whereCount = 0;
    let qb = this.lancamentoRepository
      .createQueryBuilder('lancamento') //
      .leftJoinAndSelect('lancamento._autorizacoes', 'lancamentoAutorizacao')
      .leftJoinAndSelect('lancamentoAutorizacao.user', 'lancamentoAutorizacao_user')
      .leftJoinAndSelect('lancamento.autor', 'autor')
      .leftJoinAndSelect('lancamento.clienteFavorecido', 'clienteFavorecido')
      .leftJoinAndSelect('lancamento.itemTransacao', 'itemTransacao')
      .leftJoinAndSelect('itemTransacao.itemTransacaoAgrupado', 'itemTransacaoAgrupado')
      .leftJoinAndMapOne('lancamento.detalheA', 'detalhe_a', 'detalheA', 'detalheA.itemTransacaoAgrupadoId = itemTransacaoAgrupado.id')
      .leftJoinAndMapMany('lancamento.ocorrencias', 'ocorrencia', 'ocorrencia', 'ocorrencia.detalheAId = detalheA.id')
      .leftJoinAndMapMany('lancamento.historico', 'lancamento_history', 'lancamentoHistory', 'lancamentoHistory.lancamentoId = lancamento.id')
      .leftJoinAndSelect('lancamentoHistory.autorizacoes', 'lancamentoAutorizacaoHistory')
      .leftJoinAndSelect('lancamentoAutorizacaoHistory.user', 'lancamentoAutorizacaoHistory_user');

    if (options?.where) {
      qb = qb[!whereCount ? 'where' : 'andWhere'](options?.where);
      whereCount += 1;
    }
    [qb] = this.parseQueryBuilderFindWhere(qb, andWhere, whereCount);
    qb = qb.orderBy('lancamento.id', 'DESC');
    const ret = await qb.getMany();
    return ret;
  }

  /**
   *
   * @returns [queryBuilder, whereCount]
   */
  parseQueryBuilderFindWhere(queryBuilder: SelectQueryBuilder<Lancamento>, where?: LancamentoFindWhere, whereCount = 0): [SelectQueryBuilder<Lancamento>, number] {
    let qb = queryBuilder;
    const l = Lancamento.getSqlFields('lancamento');
    if (where) {
      if (where?.detalheA) {
        qb = qb[!whereCount ? 'where' : 'andWhere']('detalheA.id IN(:daId)', { daId: where.detalheA.id.join(',') });
        whereCount += 1;
      }
      if (where?.transacaoAgrupado) {
        qb = qb[!whereCount ? 'where' : 'andWhere']('transacaoAgrupado.id = :taId', { taId: where.transacaoAgrupado.id });
        whereCount += 1;
      }
      if (where?.data_lancamento) {
        [qb, whereCount] = parseQBDateOperator(qb, l.data_lancamento, where.data_lancamento, whereCount);
      }
    }
    return [qb, whereCount];
  }

  getAll(): Promise<Lancamento[]> {
    return this.findMany();
  }

  async softDelete(id: number): Promise<DeleteResult> {
    return await this.lancamentoRepository.softDelete(id);
  }
}
