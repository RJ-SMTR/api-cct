import {  Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import {  DataSource, DeepPartial, FindManyOptions, In, InsertResult, Repository } from 'typeorm';
import { ArquivoPublicacaoBigqueryDTO } from '../domain/dto/arquivo-publicacao-bigquery.dto';
import { ArquivoPublicacao } from '../domain/entity/arquivo-publicacao.entity';
import { DetalheAService } from '../service/detalhe-a.service';
import { compactQuery } from 'src/utils/console-utils';

export interface IArquivoPublicacaoRawWhere {
  id?: number[];
  itemTransacaoAgrupadoId?: number[];
}

@Injectable()
export class ArquivoPublicacaoRepository {
  private logger = new CustomLogger('ArquivoPublicacaoRepository', { timestamp: true });

  constructor(
    @InjectRepository(ArquivoPublicacao)
    private arquivoPublicacaoRepository: Repository<ArquivoPublicacao>,
    private detalheAService: DetalheAService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * Bulk save
   */
  public async insert(dtos: DeepPartial<ArquivoPublicacao>[]): Promise<InsertResult> {
    return this.arquivoPublicacaoRepository.insert(dtos);
  }

  public async upsert(items: DeepPartial<ArquivoPublicacao>[]): Promise<InsertResult> {
    return await this.arquivoPublicacaoRepository.upsert(items, {
      conflictPaths: { id: true },
    });
  }

  public async update(id: number, dto: DeepPartial<ArquivoPublicacao>): Promise<ArquivoPublicacao> {
    await this.arquivoPublicacaoRepository.update(id, dto);
    const updated = await this.getOne({ where: { id: id } });
    return updated;
  }

  /**
   * @param startDate dataVencimento
   * @param endDate dataVencimento
   * @param page must be >= 1
   */
  async findManyByDate(startDate: Date, endDate: Date, limit?: number, page?: number): Promise<ArquivoPublicacaoBigqueryDTO[]> {
    const offset = limit && page ? (page - 1) * limit : 0;
    const rawResult: any[] = await this.dataSource.query(
      compactQuery(`
        SELECT
            ap.id, ap."dataGeracaoRetorno", ap."dataEfetivacao"::DATE, ap."dataVencimento"::DATE,
            ap."isPago", ap."valorRealEfetivado"::FLOAT, it."dataProcessamento", it."dataCaptura", it."nomeConsorcio", it.valor::FLOAT,
            cf.nome AS favorecido, it."idOrdemPagamento", it."idOperadora", it."idConsorcio", it."nomeOperadora", 
            it."dataOrdem"::DATE, json_agg(DISTINCT oc.message) AS ocorrencias
        FROM arquivo_publicacao ap
        INNER JOIN item_transacao it ON it.id = ap."itemTransacaoId"
        INNER JOIN cliente_favorecido cf ON cf.id = it."clienteFavorecidoId"
        INNER JOIN detalhe_a da ON da."itemTransacaoAgrupadoId" = it."itemTransacaoAgrupadoId"
        INNER JOIN ocorrencia oc ON oc."detalheAId" = da.id
        WHERE ap."dataVencimento"::DATE BETWEEN $1 AND $2
        GROUP BY ap.id, it.id, cf.id
        ${limit && page ? 'LIMIT $3 OFFSET $4' : ''}
    `),
      [startDate, endDate, ...(limit && page ? [limit, offset] : [])],
    );
    const publicacoes = rawResult.map((i) => new ArquivoPublicacaoBigqueryDTO(i));
    return publicacoes;
  }

  public async getOne(options: FindManyOptions<ArquivoPublicacao>): Promise<ArquivoPublicacao> {
    return await this.arquivoPublicacaoRepository.findOneOrFail(options);
  }

  public async findMany(options: FindManyOptions<ArquivoPublicacao>): Promise<ArquivoPublicacao[]> {
    return await this.arquivoPublicacaoRepository.find(options);
  }

  public async findManyRaw(where: IArquivoPublicacaoRawWhere): Promise<ArquivoPublicacao[]> {
    const qWhere: { query: string; params?: any[] } = { query: '' };
    if (where.id) {
      qWhere.query = `WHERE ap.id IN(${where.id.join(',')})`;
      qWhere.params = [];
    } else if (where.itemTransacaoAgrupadoId) {
      qWhere.query = `WHERE ita.id IN(${where.itemTransacaoAgrupadoId.join(',')})`;
      qWhere.params = [];
    }
    const result: any[] = await this.arquivoPublicacaoRepository.query(
      compactQuery(`
      SELECT
          ap.id, ap."createdAt", ap."dataEfetivacao", ap."dataGeracaoRetorno", ap."dataVencimento", ap."dataVencimento",
          ap."isPago", ap."updatedAt", ap."valorRealEfetivado",
          json_build_object(
              'id', it.id,
              'valor', it.valor,
              'itemTransacaoAgrupado', json_build_object('id', ita.id)
          ) AS "itemTransacao"
      FROM arquivo_publicacao ap
      INNER JOIN item_transacao it ON it.id = ap."itemTransacaoId"
      INNER JOIN item_transacao_agrupado ita ON ita.id = it."itemTransacaoAgrupadoId"
      ${qWhere.query}
      ORDER BY ap.id
    `),
      qWhere.params,
    );
    const itens = result.map((i) => new ArquivoPublicacao(i));
    return itens;
  }

  public async findOne(options: FindManyOptions<ArquivoPublicacao>): Promise<ArquivoPublicacao | null> {
    const many = await this.arquivoPublicacaoRepository.find(options);
    return many.pop() || null;
  }
}
