import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DeepPartial, DeleteResult, FindManyOptions, FindOneOptions, FindOptionsWhere, ObjectLiteral, QueryRunner, Repository, SaveOptions, UpdateResult } from 'typeorm';
import { Lancamento } from './entities/lancamento.entity';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { LancamentoStatus } from './enums/lancamento-status.enum';
import { compactQuery } from 'src/utils/console-utils';

export interface UpdateLancamentoWhere {
  transacaoAgrupadoId: number;
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

  async updateRaw(set: DeepPartial<Lancamento>, where: UpdateLancamentoWhere): Promise<UpdateResult> {
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

  async findMany(options?: FindManyOptions<Lancamento> | undefined, andWhere?: { detalheA: { id: number[] } }): Promise<Lancamento[]> {
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
      qb = qb[!whereCount ? 'where' : 'andWhere']('detalheA.id IN(:daId)', { daId: andWhere.detalheA.id.join(',') });
      whereCount += 1;
    }
    qb = qb.orderBy('lancamento.id', 'DESC');
    const ret = await qb.getMany();
    return ret;
  }

  getAll(): Promise<Lancamento[]> {
    return this.findMany();
  }

  delete(id: number): Promise<DeleteResult> {
    return this.lancamentoRepository.delete(id);
  }
}
