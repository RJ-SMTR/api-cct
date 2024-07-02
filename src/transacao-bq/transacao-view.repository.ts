import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import {
  DataSource,
  DeepPartial,
  FindManyOptions,
  In,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { UpsertOptions } from 'typeorm/repository/UpsertOptions';
import { IPreviousDaysArgs } from './interfaces/previous-days-args';
import { TransacaoView } from './transacao-view.entity';

@Injectable()
export class TransacaoViewRepository {
  private logger = new CustomLogger(TransacaoView.name, {
    timestamp: true,
  });

  constructor(
    private dataSource: DataSource,
    @InjectRepository(TransacaoView)
    private transacaoViewRepository: Repository<TransacaoView>,
  ) {}

  async getMaxId(): Promise<number> {
    const maxId = await this.transacaoViewRepository
      .createQueryBuilder('t')
      .select('MAX(t.id)', 'max')
      .getRawOne();
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

  public async upsert(
    dtos: DeepPartial<TransacaoView>[],
    conditions: UpsertOptions<TransacaoView>,
  ) {
    return await this.transacaoViewRepository.upsert(dtos, conditions);
  }

  public async insertByDatetime(dtos: DeepPartial<TransacaoView>[]) {
    return await this.transacaoViewRepository
      .createQueryBuilder()
      .insert()
      .into(TransacaoView)
      .values(dtos)
      .orIgnore()
      .execute();
  }

  public async getOne(
    options: FindManyOptions<TransacaoView>,
  ): Promise<TransacaoView> {
    return await this.transacaoViewRepository.findOneOrFail(options);
  }

  public async findPreviousDays(
    args: IPreviousDaysArgs,
  ): Promise<TransacaoView[]> {
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
      query = query.andWhere(
        `("operadoraCpfCnpj" IN (:cpfCnpjs) OR "consorcioCnpj" IN (:cpfCnpjs))`,
        { cpfCnpjs: cpfCnpjsStr },
      );
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

  public async find(
    options: FindManyOptions<TransacaoView>,
  ): Promise<TransacaoView[]> {
    return await this.transacaoViewRepository.find(options);
  }

  public async findExisting(
    dtos: DeepPartial<TransacaoView>[],
    skip?: number,
    take?: number,
  ){
    const transacoes = await this.transacaoViewRepository.find({
      where: {        
        idTransacao: In(dtos.map((i) => i.idTransacao)),
        updatedAt: LessThanOrEqual(new Date())
      },
      loadEagerRelations: false,
      skip,
      take,
    });
    return transacoes;
  }

  public async findOne(
    options: FindManyOptions<TransacaoView>,
  ): Promise<TransacaoView | null> {
    const many = await this.transacaoViewRepository.find(options);
    return many.pop() || null;
  }

  async updateMany(ids: number[], dto: DeepPartial<TransacaoView>) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      await queryRunner.manager.update(TransacaoView, { id: In(ids) }, dto);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Falha ao atualizar${ids.length} TransacaoViews - ${error?.message}`,
        error?.stack,
      );
    } finally {
      await queryRunner.release();
    }
  }

  createQueryBuilder = this.transacaoViewRepository.createQueryBuilder;
}
