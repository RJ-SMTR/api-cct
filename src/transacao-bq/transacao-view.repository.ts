import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compactQuery } from 'src/utils/console-utils';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityHelper } from 'src/utils/entity-helper';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DataSource, DeepPartial, EntityManager, FindManyOptions, In, LessThanOrEqual, QueryRunner, Repository } from 'typeorm';
import { IPreviousDaysArgs } from './interfaces/previous-days-args';
import { ISyncOrdemPgto } from './interfaces/sync-form-ordem.interface';
import { ITransacaoView, TransacaoView } from './transacao-view.entity';

export interface IFindRawWhere {
  idTransacao?: string[];
}

@Injectable()
export class TransacaoViewRepository {
  private logger = new CustomLogger(TransacaoView.name, { timestamp: true });

  constructor(
    private dataSource: DataSource,
    @InjectRepository(TransacaoView)
    private transacaoViewRepository: Repository<TransacaoView>,
  ) {}

  /**
   * @returns Affected rows count
   */
  async removeDuplicates() {
    const query = `
    DELETE FROM transacao_view
    WHERE id IN(
        SELECT tv.id
        FROM(
            SELECT
                tv.id,
                ROW_NUMBER() OVER (PARTITION BY tv."idTransacao" ORDER BY tv.id DESC) AS row_num
            FROM transacao_view tv
            ) tv
        WHERE tv.row_num > 1
    )
    `;
    const [, count] = await this.transacaoViewRepository.query(compactQuery(query));
    return count;
  }

  public async syncOrdemPgto(args?: ISyncOrdemPgto) {
    const where: string[] = [];
    if (args?.dataOrdem_between) {
      const [start, end] = args.dataOrdem_between.map((d) => d.toISOString());
      where.push(`DATE(tv."datetimeTransacao") BETWEEN (DATE('${start}') - INTERVAL '1 DAY') AND '${end}'`);
    }
    if (args?.nomeFavorecido?.length) {
      where.push(`cf.nome ILIKE ANY(ARRAY['%${args.nomeFavorecido.join("%', '%")}%'])`);
    }
    const query = `
    UPDATE transacao_view
    SET "itemTransacaoAgrupadoId" = associados.ita_id,
        "updatedAt" = NOW()
    FROM (	
        SELECT
            DISTINCT ON (tv.id)
            tv.id AS tv_id,
            ita.id AS ita_id,
            tv."datetimeTransacao",
            tv."datetimeProcessamento",
            ita."dataOrdem",
            ita."dataCaptura"
        FROM item_transacao_agrupado ita
        INNER JOIN detalhe_a da ON da."itemTransacaoAgrupadoId" = ita.id
        INNER JOIN item_transacao it ON it."itemTransacaoAgrupadoId" = ita.id
        INNER JOIN cliente_favorecido cf ON cf.id = it."clienteFavorecidoId"
        INNER JOIN transacao_view tv
            ON tv."idConsorcio" = ita."idConsorcio"
            AND tv."idOperadora" = ita."idOperadora"
            AND tv."operadoraCpfCnpj" = cf."cpfCnpj"
        AND tv."datetimeTransacao"::DATE BETWEEN
            (ita."dataOrdem"::DATE - (CASE WHEN ita."nomeConsorcio" = 'VLT' THEN INTERVAL '2 DAYS' ELSE INTERVAL '8 DAYS' END))  -- VENCIMENTO - 2 SE VLT; SENÃO QUINTA PGTO
            AND (DATE(ita."dataOrdem") - INTERVAL '2 DAYS')  -- VENCIMENTO - 2 (OU QUARTA PGTO SE NÃO for VLT)
        WHERE ${where.length ? `AND ${where.join(' AND ')}` : ''}
        ORDER BY tv.id ASC, ita.id DESC
    ) associados
    WHERE id = associados.tv_id
    `;
    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let count = 0;
    try {
      await queryRunner.startTransaction();
      [, count] = await queryRunner.query(compactQuery(query));
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    return count;
  }

  public async updateManyRaw(
    dtos: DeepPartial<TransacaoView>[], //
    fields: (keyof ITransacaoView)[],
    reference: keyof ITransacaoView,
    manager?: EntityManager,
  ): Promise<number> {
    const METHOD = 'updateManyRaw';
    if (dtos.length == 0) {
      this.logger.debug('Não há TransacaoView para atualizar', METHOD);
      return 0;
    }
    const updatedAt: keyof ITransacaoView = 'updatedAt';
    const query = EntityHelper.getQueryUpdate('transacao_view', dtos, fields, TransacaoView.sqlFieldTypes, reference, updatedAt);
    this.logger.debug(query);
    const [, count] = await (manager || this.transacaoViewRepository).query(compactQuery(query));
    return count;
  }

  async getMaxId(): Promise<number> {
    const maxId = await this.transacaoViewRepository.createQueryBuilder('t').select('MAX(t.id)', 'max').getRawOne();
    return maxId.max;
  }

  async count(fields?: EntityCondition<TransacaoView>) {
    if (fields) {
      return await this.transacaoViewRepository.countBy(fields);
    } else {
      return await this.transacaoViewRepository.count();
    }
  }

  public save(dto: DeepPartial<TransacaoView>): Promise<TransacaoView> {
    return this.transacaoViewRepository.save(dto);
  }

  public async getOne(options: FindManyOptions<TransacaoView>): Promise<TransacaoView> {
    return await this.transacaoViewRepository.findOneOrFail(options);
  }

  public async findPreviousDays(args: IPreviousDaysArgs): Promise<TransacaoView[]> {
    // Filter date
    let query = this.transacaoViewRepository
      .createQueryBuilder()
      /** Se transacao < processamento */
      .where('"datetimeTransacao" < "datetimeProcessamento"')
      /** E se não for no mesmo dia */
      .andWhere(
        `TO_CHAR(date_trunc('day', "datetimeTransacao"),'YYYY-MM-DD')
        <> TO_CHAR(date_trunc('day', "datetimeProcessamento"),'YYYY-MM-DD')`,
      )
      /** E dentro do intervalo */
      .andWhere(`"datetimeProcessamento" BETWEEN :startDate AND :endDate`, {
        startDate: args.startDate,
        endDate: args.endDate,
      });

    // cpfCnpj
    if (args.cpfCnpjs.length) {
      const cpfCnpjsStr = args.cpfCnpjs.join("','");
      query = query.andWhere(`("operadoraCpfCnpj" IN (:cpfCnpjs) OR "consorcioCnpj" IN (:cpfCnpjs))`, { cpfCnpjs: cpfCnpjsStr });
    }
    query = query.orderBy('"datetimeProcessamento"', 'ASC');

    // Pagination
    if (args.pageStart) {
      query = query.skip(args.pageStart);
    }
    if (args.pageLimit) {
      query = query.take(args.pageLimit);
    }

    const items = await query.getMany();
    const joinedItems = await this.find({
      where: {
        id: In(items.map((i) => i.id)),
      },
      order: {
        datetimeProcessamento: 'DESC',
      },
    });
    return joinedItems;
  }

  public async find(options: FindManyOptions<TransacaoView>): Promise<TransacaoView[]> {
    return await this.transacaoViewRepository.find(options);
  }

  public async findRaw(where?: IFindRawWhere): Promise<TransacaoView[]> {
    const tv = TransacaoView.getSqlFields('tv');
    const qWhere: string[] = [];
    if (where?.idTransacao?.length) {
      qWhere.push(`${tv.idTransacao} IN ('${where.idTransacao.join("','")}')`);
    }
    const selectTv =
      Object.values(tv)
        .filter((i) => i != `tv.${tv.arquivoPublicacao}`)
        .join(',') + `, json_build_object('id', ${tv.arquivoPublicacao}) AS "arquivoPublicacao"`;
    const raw: any[] = await this.transacaoViewRepository.query(
      compactQuery(`
      SELECT ${selectTv}
      FROM transacao_view tv
      ${where ? 'WHERE ' + qWhere.join(' AND ') : ''}
      ORDER BY tv.id DESC
    `),
    );
    const result = raw.map((i) => new TransacaoView(i));
    return result;
  }

  public async findUpdateValues(diasAnteriores?: number): Promise<TransacaoView[]> {
    const raw: any[] = await this.transacaoViewRepository.query(
      compactQuery(`
      SELECT tv.id, tv."idTransacao", tv."valorPago"
      FROM transacao_view tv
      WHERE NOT tv."valorPago" > 0 ${diasAnteriores ? `AND tv."datetimeProcessamento"::DATE >= NOW() - INTERVAL '${diasAnteriores} DAYS'` : ''}
      ORDER BY tv.id DESC
    `),
    );
    const result = raw.map((i) => new TransacaoView(i));
    return result;
  }

  public async findAndCount(options: FindManyOptions<TransacaoView>): Promise<[TransacaoView[], number]> {
    return await this.transacaoViewRepository.findAndCount(options);
  }

  public async findExisting(dtos: DeepPartial<TransacaoView>[], skip?: number, take?: number) {
    const transacoes = await this.transacaoViewRepository.find({
      where: {
        idTransacao: In(dtos.map((i) => i.idTransacao)),
        updatedAt: LessThanOrEqual(new Date()),
      },
      loadEagerRelations: false,
      skip,
      take,
    });
    return transacoes;
  }

  public async findOne(options: FindManyOptions<TransacaoView>): Promise<TransacaoView | null> {
    const many = await this.transacaoViewRepository.find(options);
    return many.pop() || null;
  }

  createQueryBuilder = this.transacaoViewRepository.createQueryBuilder;
}
