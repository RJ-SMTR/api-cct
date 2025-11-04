import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SqlDateOperator } from 'src/utils/sql/interfaces/sql-date-operator.interface';
import { DeepPartial, FindOptionsWhere, QueryRunner, Repository, SaveOptions, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { LancamentoAutorizacao } from '../domain/entity/lancamento-autorizacao.entity';
import { Lancamento } from '../domain/entity/lancamento.entity';

export interface LancamentoFindWhere {
  detalheA?: { id: number[] };
  transacaoAgrupado?: { id: number };
  data_lancamento?: SqlDateOperator;
}

@Injectable()
export class LancamentoAutorizacaoRepository {
  constructor(
    @InjectRepository(LancamentoAutorizacao)
    private readonly lancamentoAutorizacaoRepository: Repository<LancamentoAutorizacao>,
  ) {}

  create(entityLike: DeepPartial<LancamentoAutorizacao>): LancamentoAutorizacao {
    return this.lancamentoAutorizacaoRepository.create(entityLike);
  }

  save(entity: DeepPartial<LancamentoAutorizacao>, options?: SaveOptions): Promise<LancamentoAutorizacao> {
    return this.lancamentoAutorizacaoRepository.save(entity, options);
  }

  update(criteria: FindOptionsWhere<Lancamento>, partialEntity: QueryDeepPartialEntity<Lancamento>, queryRunner?: QueryRunner): Promise<UpdateResult> {
    return (queryRunner?.manager?.getRepository(Lancamento) || this.lancamentoAutorizacaoRepository).update(criteria, partialEntity);
  }

  delete(options: FindOptionsWhere<LancamentoAutorizacao>) {
    return this.lancamentoAutorizacaoRepository.delete(options);
  }
}
