import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compactQuery } from 'src/utils/console-utils';
import { CustomLogger } from 'src/utils/custom-logger';
import { formatDateISODate } from 'src/utils/date-utils';
import { EntityHelper } from 'src/utils/entity-helper';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DataSource, DeepPartial, EntityManager, FindManyOptions, In, LessThanOrEqual, Repository } from 'typeorm';
import { IPreviousDaysArgs } from './interfaces/previous-days-args';
import { IClearSyncOrdemPgto, ISyncOrdemPgto } from './interfaces/sync-transacao-ordem.interface';
import { ITransacaoView, TransacaoView } from './transacao-view.entity';
import { subDays } from 'date-fns';

export interface TransacaoViewFindRawOptions {
  where: {
    idTransacao?: string[];
    operadoraCpfCnpj?: string[];
    datetimeTransacao?: { between: [Date, Date][] };
    datetimeProcessamento?: { between: [Date, Date][] };
  };
  order?: {
    datetimeProcessamento?: 'ASC' | 'DESC';
    id?: 'ASC' | 'DESC';
  };
  distinct?: 'id';
  eager?: boolean;
  limit?: number;
  offset?: number;
}

export interface TVFindUpdateValuesWhere {
  diasAnteriores?: number;
  idOperadora?: string[];
  valorPago_gt_zero?: boolean;
  datetimeProcessamento?: { start: Date; end: Date };
  nomeConsorcio?: string[];
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
  async removeDuplicates(dataOrdemIncial?: Date, dataOrdemFinal?: Date) {
    const where: string[] = [];
    if (dataOrdemIncial && dataOrdemFinal) {
      where.push(`tv."datetimeProcessamento"::DATE BETWEEN '${subDays(dataOrdemIncial, 6).toISOString()}'::DATE AND '${subDays(dataOrdemFinal, 1).toISOString()}'::DATE`);
    }
    const query = `
    DELETE FROM transacao_view
    WHERE id IN(
        SELECT tv.id
        FROM(
            SELECT
                tv.id,
                ROW_NUMBER() OVER (PARTITION BY tv."idTransacao" ORDER BY tv.id DESC) AS row_num
            FROM transacao_view tv
            WHERE (1=1) ${where.length ? 'AND ' + where.join(' AND ') : ''}
            ) tv
        WHERE tv.row_num > 1
    )
    `;
    const [, count] = await this.transacaoViewRepository.query(compactQuery(query));
    return count;
  }

  /**
   * Remove associação de todas as transações no intervalo
   */
  public async clearSyncOrdemPgto(args?: IClearSyncOrdemPgto) {
    const METHOD = 'syncOrdemPgto';
    const where: string[] = [];
    if (args?.dataOrdem_between) {
      const [start, end] = args.dataOrdem_between.map((d) => d.toISOString());
      where.push(`DATE(tv."datetimeProcessamento") + INTERVAL '1 DAY' BETWEEN DATE('${start}') AND DATE('${end}')`);
    }
    if (args?.consorcio) {
      where.push(`tv."nomeConsorcio" IN('${args.consorcio.join("','")}')`);
    }
    if (args?.nomeFavorecido?.length) {
      where.push(`cf.nome ILIKE ANY(ARRAY['%${args.nomeFavorecido.join("%', '%")}%'])`);
    }

    const query = `
    UPDATE transacao_view
    SET "itemTransacaoAgrupadoId" = NULL,
        "updatedAt" = NOW()
    FROM (
        SELECT DISTINCT ON (q.tv_id) * FROM (
            SELECT
                cf.nome,
                tv.id AS tv_id,
                tv."datetimeTransacao",
                tv."datetimeProcessamento",
                tv."valorPago"
            FROM transacao_view tv
            LEFT JOIN cliente_favorecido cf ON cf."cpfCnpj" = tv."operadoraCpfCnpj"
            WHERE (1=1) ${where.length ? `AND ${where.join(' AND ')}` : ''}
            ORDER BY tv.id ASC
        ) q
        ORDER BY q.tv_id
    ) associados
    WHERE id = associados.tv_id  `;

    this.logger.debug('query: ' + compactQuery(query), METHOD);
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

  /**
   * ## Sobre
   *
   * Para cada transação, obtém uma lista de ordens e associa com a ordme mais apropriada;
   *
   * ## Query
   *
   * Filtros
   * - Filtros deste método (e.g. data início/fim)
   * - Ignora ordens canceladas (com status 5)
   * - Para cada ordem, verificamos se existe uma transação entre dataOrdem D1-D6.
   *
   * Prioridade da ordem por transação após os filtros:
   * 1. A ordem que tiver a máxima prioridade de data D1, D2, D3, D4, D5, D6 respectivamente
   */
  public async syncOrdemPgto(args?: ISyncOrdemPgto) {
    const METHOD = 'syncOrdemPgto';
    const where: string[] = [];
    if (args?.dataOrdem_between) {
      const [start, end] = args.dataOrdem_between.map((d) => d.toISOString());
      where.push(`DATE(tv."datetimeProcessamento") + INTERVAL '1 DAY' BETWEEN DATE('${start}') AND DATE('${end}')`);
    }

    if (args?.consorcio?.in?.length) {
      where.push(`it."nomeConsorcio" IN('${args.consorcio.in.join("','")}')`);
    }
    if (args?.consorcio?.notIn?.length) {
      where.push(`it."nomeConsorcio" NOT IN('${args.consorcio.notIn.join("','")}')`);
    }

    if (args?.nomeFavorecido?.length) {
      where.push(`cf.nome ILIKE ANY(ARRAY['%${args.nomeFavorecido.join("%', '%")}%'])`);
    }

    const query = `
    UPDATE transacao_view
    SET "itemTransacaoAgrupadoId" = associados.ita_id,
        "updatedAt" = NOW()
    FROM (
        SELECT DISTINCT ON (q.tv_id) * FROM (
            SELECT
                cf.nome,
                tv.id AS tv_id,
                it."dataOrdem",
                tv."datetimeTransacao",
                tv."datetimeProcessamento",
                tv."valorPago",
                it.valor  AS valor_ordem,
                (it."dataOrdem"::DATE - tv."datetimeProcessamento"::DATE) AS date_priority,
                ita."valor",
                it."dataCaptura",
                da."dataVencimento",
                ta."statusId" AS ordem_status_id,
                ts.name AS ordem_status,
                ita.id ita_id,
                it.id AS it_id
            FROM item_transacao_agrupado ita
            INNER JOIN detalhe_a da ON da."itemTransacaoAgrupadoId" = ita.id
            INNER JOIN item_transacao it ON it."itemTransacaoAgrupadoId" = ita.id
            INNER JOIN transacao tr ON tr.id = it."transacaoId"
            INNER JOIN transacao_agrupado ta ON ta.id = tr."transacaoAgrupadoId" AND ta."statusId" != 5
            INNER JOIN transacao_status ts ON ts.id = ta."statusId"
            INNER JOIN cliente_favorecido cf ON cf.id = it."clienteFavorecidoId"
            INNER JOIN transacao_view tv
                ON tv."idConsorcio" = ita."idConsorcio"
                AND tv."idOperadora" = ita."idOperadora"
                AND tv."operadoraCpfCnpj" = cf."cpfCnpj"
                AND tv."datetimeProcessamento"::DATE BETWEEN (it."dataOrdem"::DATE) - INTERVAL '6 DAYS' AND it."dataOrdem"::DATE - INTERVAL '1 DAY'
            WHERE (1=1) ${where.length ? `AND ${where.join(' AND ')}` : ''}
            ORDER BY tv.id ASC, it."dataOrdem"
        ) q
        ORDER BY q.tv_id, q.date_priority, q.it_id DESC
    ) associados
    WHERE id = associados.tv_id
    `;

    this.logger.debug('query: ' + compactQuery(query), METHOD);
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
    this.logger.debug('query: ' + compactQuery(query), METHOD);
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

  public async findRaw(options?: TransacaoViewFindRawOptions): Promise<TransacaoView[]> {
    const tv = TransacaoView.getSqlFields('tv');
    const qWhere: string[] = [];
    const eager = options?.eager !== undefined ? options.eager : true;

    if (options?.where?.idTransacao?.length) {
      qWhere.push(`${tv.idTransacao} IN ('${options.where?.idTransacao.join("','")}')`);
    }
    if (options?.where?.operadoraCpfCnpj?.length) {
      qWhere.push(`${tv.operadoraCpfCnpj} IN ('${options.where?.operadoraCpfCnpj.join("','")}')`);
    }
    if (options?.where?.datetimeTransacao) {
      const betweenStr = options.where.datetimeTransacao.between.map(([start, end]) => `${tv.datetimeTransacao}::DATE BETWEEN '${formatDateISODate(start)}' AND '${formatDateISODate(end)}'`).join(' OR ');
      qWhere.push(`(${betweenStr})`);
    }
    if (options?.where?.datetimeProcessamento) {
      const betweenStr = options.where.datetimeProcessamento.between.map(([start, end]) => `${tv.datetimeProcessamento}::DATE BETWEEN '${formatDateISODate(start)}' AND '${formatDateISODate(end)}'`).join(' OR ');
      qWhere.push(`(${betweenStr})`);
    }

    const order: string[] = [];
    if (options?.order?.datetimeProcessamento) {
      order.push(`${tv.datetimeProcessamento} ${options.order.datetimeProcessamento}`);
    }
    if (options?.order?.id) {
      order.push(`tv.id ${options.order.id}`);
    }

    const selectTv =
      Object.values(TransacaoView.getSqlFields('tv', true))
        .filter((i) => !i.startsWith(`tv.${tv.arquivoPublicacao}`))
        .join(',') +
      `, json_build_object(
            'id', ${tv.arquivoPublicacao},
            'isPago', ap."isPago",
            ${eager ? `'itemTransacao', json_build_object('id', it.id, 'itemTransacaoAgrupado', json_build_object('id', ita.id))` : ''}
        ) AS "arquivoPublicacao"`;
    const query = `
      SELECT ${options?.distinct ? 'DISTINCT ON (tv.id)' : ''} ${selectTv}
      FROM transacao_view tv
      ${
        eager
          ? `LEFT JOIN item_transacao_agrupado ita ON ita.id = tv."itemTransacaoAgrupadoId"
      LEFT JOIN item_transacao it ON it."itemTransacaoAgrupadoId" = ita.id
      LEFT JOIN arquivo_publicacao ap ON ap."itemTransacaoId" = it.id`
          : ''
      }
      ${options ? 'WHERE ' + qWhere.join(' AND ') : ''}
      ORDER BY ${order.length ? order.join(', ') : 'tv.id DESC'}
    `;
    const raw: any[] = await this.transacaoViewRepository.query(compactQuery(query));
    const result = raw.map((i) => new TransacaoView(i));
    return result;
  }

  public async findUpdateValues(where?: TVFindUpdateValuesWhere): Promise<TransacaoView[]> {
    const tv = TransacaoView.getSqlFields('tv');
    const qWhere: string[] = [];
    if (where?.valorPago_gt_zero == false) {
      qWhere.push(`NOT ${tv.valorPago} > 0`);
    }
    if (where?.valorPago_gt_zero == true) {
      qWhere.push(`${tv.valorPago} > 0`);
    }
    if (where?.datetimeProcessamento) {
      const { start, end } = where.datetimeProcessamento;
      qWhere.push(`${tv.datetimeProcessamento}::DATE BETWEEN '${start.toISOString()}'::DATE AND '${end.toISOString()}'::DATE`);
    }
    if (where?.diasAnteriores) {
      qWhere.push(`${tv.datetimeProcessamento}::DATE >= NOW() - INTERVAL '${where?.diasAnteriores} DAYS'`);
    }
    if (where?.idOperadora?.length) {
      qWhere.push(`${tv.idOperadora} IN('${where?.idOperadora.join("','")}')`);
    }
    if (where?.nomeConsorcio?.length) {
      qWhere.push(`${tv.nomeConsorcio} IN('${where?.nomeConsorcio.join("','")}')`);
    }
    const raw: any[] = await this.transacaoViewRepository.query(
      compactQuery(`
      SELECT ${tv.id}, ${tv.idTransacao}, ${tv.valorPago}::FLOAT, ${tv.tipoTransacao}, ${tv.idOperadora}, ${tv.operadoraCpfCnpj}
      FROM transacao_view tv
      ${qWhere.length ? `WHERE ${qWhere.join(' AND ')}` : ''}
      ORDER BY ${tv.id} DESC
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
