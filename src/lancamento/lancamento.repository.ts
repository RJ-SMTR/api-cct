import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, DeleteResult, FindManyOptions, FindOneOptions, Repository, SaveOptions } from 'typeorm';
import { Lancamento } from './entities/lancamento.entity';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';

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

  async findOne(options: FindOneOptions<Lancamento>): Promise<Lancamento | null> {
    let qb = this.lancamentoRepository
      .createQueryBuilder('lancamento') //
      .leftJoinAndSelect('lancamento.autorizacoes', 'autorizacoes')
      .leftJoinAndSelect('lancamento.autor', 'autor')
      .leftJoinAndSelect('lancamento.itemTransacao', 'itemTransacao')
      .leftJoinAndSelect('itemTransacao.itemTransacaoAgrupado', 'itemTransacaoAgrupado')
      // .leftJoin('detalhe_a', 'detalheA', 'detalheA.itemTransacaoAgrupadoId = itemTransacaoAgrupado.id')
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
      .leftJoinAndSelect('lancamento.itemTransacao', 'itemTransacao')
      .leftJoinAndSelect('itemTransacao.itemTransacaoAgrupado', 'itemTransacaoAgrupado')
      // .leftJoin('detalhe_a', 'detalheA', 'detalheA.itemTransacaoAgrupadoId = itemTransacaoAgrupado.id')
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
